-- 20260707000003_kan305_0002_block_aware_rpc_patches.sql
-- =============================================================================
-- KAN-305 — Block User: enforcement layer, file 2 of 3.
--
-- CREATE OR REPLACE the six consent / discovery RPCs to consult the block pair.
-- Each body below is LIVE-VERBATIM as of 2026-07-07 (read via pg_get_functiondef
-- on jiyetphxxvyiicrnwlnx) PLUS the minimal block predicate at the SEC/DBA-
-- specified position — no other behaviour change. Live is the source of truth;
-- these bodies must be re-diffed against live at apply time if live has drifted.
--
-- ⚠ MIRROR-ON-FILE — DO NOT AUTO-APPLY.
--
-- Error-shape asymmetry (SEC + DBA co-ruling; register §D): the BLOCKER sees an
-- explicit state the FE can act on (offer Unblock); the BLOCKED party sees only
-- the generic error a stranger / nonexistent / deactivated user already
-- produces — the word "blocked" never crosses to them (silence guarantee).
-- Direction is resolved by asking "is the caller the blocker?" (explicit) vs
-- "is the caller the blocked party?" (generic mask).
--
-- Directory suppression (search_leaders, get_invite_candidates) uses
-- fn_is_blocked_identity_known — masked-context blocks do NOT vanish named
-- directory rows (SEC §3.3 de-masking-oracle prevention). Contact gates use the
-- plain symmetric fn_is_blocked (all blocks stop contact).
--
-- Replant Team secure threads: get_leader_thread_list keeps is_secure_replant_
-- thread conversations unfiltered (the moderation channel is never severed).
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- send_connection_request — pair check after recipient validation.
--   Blocker (caller blocked target) -> recipient_blocked_by_you (explicit).
--   Blocked (target blocked caller)  -> recipient_not_found (mask — same class
--     a nonexistent/deactivated recipient produces above).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_connection_request(p_recipient_id uuid, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_recipient_ok boolean;
  v_new_id uuid;
  v_a uuid;
  v_b uuid;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_verified_sender';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_caller_id THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;

  IF p_message IS NULL OR char_length(btrim(p_message)) = 0
     OR char_length(p_message) > 5000 THEN
    RAISE EXCEPTION 'invalid_message';
  END IF;

  SELECT (verification_status = 'verified' AND is_active = true)
    INTO v_recipient_ok
  FROM public.users
  WHERE id = p_recipient_id;
  IF v_recipient_ok IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;
  IF v_recipient_ok = false THEN
    RAISE EXCEPTION 'recipient_not_verified';
  END IF;

  -- KAN-305 block gate (asymmetric; runs in the same position as recipient
  -- validity so there is no timing/ordering oracle).
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = v_caller_id AND blocked_id = p_recipient_id
  ) THEN
    RAISE EXCEPTION 'recipient_blocked_by_you';
  ELSIF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = p_recipient_id AND blocked_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'recipient_not_found';   -- mask: identical to nonexistent.
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE status = 'pending'
      AND (
        (sender_id = v_caller_id AND recipient_id = p_recipient_id)
        OR
        (sender_id = p_recipient_id AND recipient_id = v_caller_id)
      )
  ) THEN
    RAISE EXCEPTION 'pending_request_exists';
  END IF;

  v_a := LEAST(v_caller_id, p_recipient_id);
  v_b := GREATEST(v_caller_id, p_recipient_id);
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE participant_a = v_a AND participant_b = v_b
  ) THEN
    RAISE EXCEPTION 'conversation_exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE sender_id = v_caller_id
      AND recipient_id = p_recipient_id
      AND status = 'declined'
      AND declined_at IS NOT NULL
      AND declined_at > (now() - INTERVAL '30 days')
  ) THEN
    RAISE EXCEPTION 'cooldown_active';
  END IF;

  INSERT INTO public.connection_requests (sender_id, recipient_id, message)
  VALUES (v_caller_id, p_recipient_id, p_message)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- respond_to_connection_request — accept-path pair re-check (block-vs-accept
--   race; auto-decline at block time is primary, this is the belt). Masked as
--   request_not_found — the request "no longer exists" to the accepter.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_connection_request(p_request_id uuid, p_action text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_req       public.connection_requests%ROWTYPE;
  v_conv_id   uuid;
  v_a         uuid;
  v_b         uuid;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_req.recipient_id <> v_caller_id THEN
    RAISE EXCEPTION 'not_recipient';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF p_action = 'decline' THEN
    UPDATE public.connection_requests
    SET status = 'declined', declined_at = now(), responded_at = now()
    WHERE id = v_req.id;
    RETURN NULL;
  END IF;

  -- KAN-305 block gate on accept (belt for the block-raced-after-request
  -- window). A block in EITHER direction voids the accept; masked as
  -- request_not_found so neither party learns a block exists via this path.
  IF public.fn_is_blocked(v_req.sender_id, v_req.recipient_id) THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  -- accept: create/reuse conversation only. Message seeded by FE via
  -- send-message edge fn so FLAG_TAXONOMY scanning fires (SEC condition).
  v_a := LEAST(v_req.sender_id, v_req.recipient_id);
  v_b := GREATEST(v_req.sender_id, v_req.recipient_id);

  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE participant_a = v_a AND participant_b = v_b;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_a, participant_b, last_message_at)
    VALUES (v_a, v_b, now())
    RETURNING id INTO v_conv_id;
  ELSE
    UPDATE public.conversations
    SET last_message_at = now()
    WHERE id = v_conv_id;
  END IF;

  UPDATE public.connection_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = v_req.id;

  RETURN v_conv_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_or_create_conversation_if_permitted — same-church bypass pair check.
--   Blocker  -> recipient_blocked_by_you (explicit).
--   Blocked  -> requires_connection_request (indistinguishable from a stranger
--     who is simply not same-church — the most benign existing outcome).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_conversation_if_permitted(p_recipient_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id    uuid;
  v_caller_church uuid;
  v_recip_church  uuid;
  v_recip_ok      boolean;
  v_a             uuid;
  v_b             uuid;
  v_conv_id       uuid;
BEGIN
  -- Resolve caller.
  SELECT u.id, u.church_id
    INTO v_caller_id, v_caller_church
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_caller_id THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;

  -- Validate recipient.
  SELECT (u.verification_status = 'verified' AND u.is_active = true),
         u.church_id
    INTO v_recip_ok, v_recip_church
  FROM public.users u
  WHERE u.id = p_recipient_id;

  IF v_recip_ok IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;
  IF v_recip_ok = false THEN
    RAISE EXCEPTION 'recipient_not_verified';
  END IF;

  -- KAN-305 block gate (asymmetric). Placed before the in-network decision so
  -- a same-church block cannot open a 1:1. Blocker sees the explicit state;
  -- blocked party is folded into the ordinary requires_connection_request
  -- (stranger) outcome — no oracle.
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = v_caller_id AND blocked_id = p_recipient_id
  ) THEN
    RAISE EXCEPTION 'recipient_blocked_by_you';
  ELSIF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = p_recipient_id AND blocked_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'requires_connection_request';
  END IF;

  -- In-network check: same church only.
  -- Branch membership does NOT bypass — a leader may join a branch
  -- without knowing who else is in it, so shared branch membership
  -- must not open an unrequested 1:1 DM path (Founder ruling 2026-06-09).
  IF v_caller_church IS NULL
     OR v_recip_church IS NULL
     OR v_caller_church <> v_recip_church THEN
    RAISE EXCEPTION 'requires_connection_request';
  END IF;

  -- Same church — find or create the conversation.
  v_a := LEAST(v_caller_id, p_recipient_id);
  v_b := GREATEST(v_caller_id, p_recipient_id);

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.participant_a = v_a AND c.participant_b = v_b;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_a, participant_b, last_message_at)
    VALUES (v_a, v_b, now())
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_leader_thread_list — filter blocked pairs from BOTH the conversation
--   rows and the request rows, on BOTH sides, EXCEPT Replant Team secure
--   threads (never severed). This single filter also keeps the unread badge
--   (fetchTotalUnread derives from this RPC) consistent for free.
--
--   Blocker side: thread + requests vanish (freeze-and-hide, SEC 1.4). Blocked
--   side: because the pair check is symmetric, their view of THIS thread also
--   hides — but the blocked party keeps a normal-looking app (their sends fail
--   with the generic deactivated-counterparty envelope; the thread simply drops
--   from the list, which is already an existing state for expired/withdrawn
--   rows, not a block-only observable). Pre-block history in an already-open
--   thread is unaffected (no new rows can be inserted; DMThreadView reads under
--   messages_select_own — see DBA Decision 12.2).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leader_thread_list()
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_full_name text, other_display_name_preference text, other_role text, other_anonymous boolean, other_church_id uuid, other_church_name text, other_underground boolean, is_secure_replant_thread boolean, last_message_preview text, last_message_at timestamp with time zone, unread_count bigint, row_kind text, request_id uuid, request_sent_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_ignore    integer;
BEGIN
  SELECT u.id INTO v_caller_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_ignore := public.expire_pending_requests();

  RETURN QUERY
  WITH
  my_threads AS (
    SELECT c.id, c.participant_a, c.participant_b,
           c.is_secure_replant_thread,
           CASE WHEN c.participant_a = v_caller_id
                THEN c.last_read_at_a ELSE c.last_read_at_b END AS my_last_read_at,
           CASE WHEN c.participant_a = v_caller_id
                THEN c.participant_b ELSE c.participant_a END AS other_id
    FROM public.conversations c
    WHERE (c.participant_a = v_caller_id OR c.participant_b = v_caller_id)
      -- KAN-305: hide a blocked-pair thread from the list, but NEVER a
      -- Replant Team secure thread (moderation channel exempt, SEC 1.13).
      AND (
        c.is_secure_replant_thread = true
        OR NOT public.fn_is_blocked(
             v_caller_id,
             CASE WHEN c.participant_a = v_caller_id
                  THEN c.participant_b ELSE c.participant_a END)
      )
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id AS msg_conv_id, m.content, m.created_at
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT t.id FROM my_threads t)
      AND m.is_active = true
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  conv_rows AS (
    SELECT
      t.id                                                  AS c_conversation_id,
      t.other_id                                            AS c_other_user_id,
      CASE WHEN t.is_secure_replant_thread THEN 'Replant Team'
           WHEN COALESCE(u.anonymous, false) = true THEN NULL
           ELSE public.resolve_display_name(
             u.first_name, u.middle_name, u.last_name,
             u.honorific, u.role::text,
             u.display_name_preference, u.last_name_first
           ) END                                            AS c_other_full_name,
      u.display_name_preference                             AS c_other_display_name_preference,
      COALESCE(u.role::text, 'system')                      AS c_other_role,
      COALESCE(u.anonymous, false)                          AS c_other_anonymous,
      u.church_id                                           AS c_other_church_id,
      CASE WHEN t.is_secure_replant_thread THEN NULL
           WHEN ch.type = 'underground' THEN 'Underground Church'
           ELSE ch.name END                                 AS c_other_church_name,
      COALESCE(ch.type = 'underground', false)              AS c_other_underground,
      t.is_secure_replant_thread                            AS c_is_secure,
      LEFT(lm.content, 60)                                  AS c_preview,
      lm.created_at                                         AS c_last_at,
      (
        SELECT COUNT(*) FROM public.messages m2
        WHERE m2.conversation_id = t.id
          AND m2.is_active = true
          AND m2.sender_id <> v_caller_id
          AND (t.my_last_read_at IS NULL OR m2.created_at > t.my_last_read_at)
      )                                                     AS c_unread,
      CASE WHEN t.is_secure_replant_thread THEN 1 ELSE 0 END AS c_sort_secure
    FROM my_threads t
    LEFT JOIN public.users    u  ON u.id  = t.other_id
    LEFT JOIN public.churches ch ON ch.id = u.church_id
    LEFT JOIN last_msg        lm ON lm.msg_conv_id = t.id
  ),
  req_rows AS (
    SELECT
      CASE WHEN cr.sender_id = v_caller_id
           THEN cr.recipient_id ELSE cr.sender_id END       AS r_other_user_id,
      CASE WHEN COALESCE(ou.anonymous, false) = true THEN NULL
           ELSE public.resolve_display_name(
             ou.first_name, ou.middle_name, ou.last_name,
             ou.honorific, ou.role::text,
             ou.display_name_preference, ou.last_name_first
           ) END                                            AS r_other_full_name,
      ou.display_name_preference                            AS r_other_display_name_preference,
      COALESCE(ou.role::text, 'system')                     AS r_other_role,
      COALESCE(ou.anonymous, false)                         AS r_other_anonymous,
      ou.church_id                                          AS r_other_church_id,
      CASE WHEN och.type = 'underground' THEN 'Underground Church'
           ELSE och.name END                                AS r_other_church_name,
      COALESCE(och.type = 'underground', false)             AS r_other_underground,
      LEFT(cr.message, 60)                                  AS r_preview,
      cr.sent_at                                            AS r_last_at,
      CASE
        WHEN cr.recipient_id = v_caller_id AND cr.status = 'pending'
          THEN 1::bigint ELSE 0::bigint
      END                                                   AS r_unread,
      CASE
        WHEN cr.recipient_id = v_caller_id AND cr.status = 'pending'  THEN 'request_incoming'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'pending'   THEN 'request_pending'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'declined'  THEN 'request_declined'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'expired'   THEN 'request_expired'
      END                                                   AS r_row_kind,
      cr.id                                                 AS r_request_id,
      cr.sent_at                                            AS r_request_sent_at,
      cr.sent_at                                            AS r_sent_at,
      cr.declined_at                                        AS r_declined_at,
      cr.expires_at                                         AS r_expires_at
    FROM public.connection_requests cr
    LEFT JOIN public.users    ou  ON ou.id =
      CASE WHEN cr.sender_id = v_caller_id THEN cr.recipient_id ELSE cr.sender_id END
    LEFT JOIN public.churches och ON och.id = ou.church_id
    WHERE (
        (cr.recipient_id = v_caller_id AND cr.status = 'pending')
        OR
        (cr.sender_id = v_caller_id AND cr.status IN ('pending','declined','expired'))
      )
      -- KAN-305: drop request rows for a blocked pair (either direction).
      AND NOT public.fn_is_blocked(
            v_caller_id,
            CASE WHEN cr.sender_id = v_caller_id THEN cr.recipient_id ELSE cr.sender_id END)
  )
  SELECT
    x.conv_id, x.ou_id, x.ou_full_name, x.ou_display_pref,
    x.ou_role, x.ou_anon, x.ou_church_id, x.ou_church_name,
    x.ou_underground, x.is_secure, x.preview, x.last_at,
    x.unread, x.rk, x.req_id, x.req_sent_at
  FROM (
    SELECT
      cr.c_conversation_id    AS conv_id,
      cr.c_other_user_id      AS ou_id,
      cr.c_other_full_name    AS ou_full_name,
      cr.c_other_display_name_preference AS ou_display_pref,
      cr.c_other_role         AS ou_role,
      cr.c_other_anonymous    AS ou_anon,
      cr.c_other_church_id    AS ou_church_id,
      cr.c_other_church_name  AS ou_church_name,
      cr.c_other_underground  AS ou_underground,
      cr.c_is_secure          AS is_secure,
      cr.c_preview            AS preview,
      cr.c_last_at            AS last_at,
      cr.c_unread             AS unread,
      'conversation'::text    AS rk,
      NULL::uuid              AS req_id,
      NULL::timestamptz       AS req_sent_at,
      cr.c_sort_secure        AS sort_secure,
      CASE
        WHEN cr.c_is_secure                              THEN 0
        WHEN cr.c_unread > 0                             THEN 2
        ELSE 3
      END                     AS grp,
      cr.c_last_at            AS conv_at,
      NULL::timestamptz       AS r_sent,
      NULL::timestamptz       AS r_declined,
      NULL::timestamptz       AS r_expires
    FROM conv_rows cr
    UNION ALL
    SELECT
      NULL::uuid              AS conv_id,
      rr.r_other_user_id      AS ou_id,
      rr.r_other_full_name    AS ou_full_name,
      rr.r_other_display_name_preference AS ou_display_pref,
      rr.r_other_role         AS ou_role,
      rr.r_other_anonymous    AS ou_anon,
      rr.r_other_church_id    AS ou_church_id,
      rr.r_other_church_name  AS ou_church_name,
      rr.r_other_underground  AS ou_underground,
      false                   AS is_secure,
      rr.r_preview            AS preview,
      rr.r_last_at            AS last_at,
      rr.r_unread             AS unread,
      rr.r_row_kind           AS rk,
      rr.r_request_id         AS req_id,
      rr.r_request_sent_at    AS req_sent_at,
      0                       AS sort_secure,
      CASE
        WHEN rr.r_row_kind = 'request_incoming' THEN 1
        WHEN rr.r_row_kind = 'request_pending'  THEN 4
        WHEN rr.r_row_kind = 'request_declined' THEN 5
        WHEN rr.r_row_kind = 'request_expired'  THEN 6
        ELSE 9
      END                     AS grp,
      NULL::timestamptz       AS conv_at,
      rr.r_sent_at            AS r_sent,
      rr.r_declined_at        AS r_declined,
      rr.r_expires_at         AS r_expires
    FROM req_rows rr
  ) x
  ORDER BY
    x.grp ASC,
    COALESCE(x.conv_at, '1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_sent,    '1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_declined,'1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_expires, '1970-01-01'::timestamptz) DESC;
END;
$function$;

-- ----------------------------------------------------------------------------
-- search_leaders — suppress blocked pairs, IDENTITY-KNOWN blocks only
--   (SEC §3.3). A masked-context block does NOT remove the named person from
--   search, so the blocker cannot diff the directory to resolve the mask.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_leaders(p_query text)
 RETURNS TABLE(user_id uuid, full_name text, role text, anonymous boolean, church_id uuid, church_name text, underground boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_q         text := lower(trim(COALESCE(p_query, '')));
BEGIN
  IF length(v_q) < 2 THEN
    RAISE EXCEPTION 'query_too_short';
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT
    u.id                                                              AS user_id,
    -- full_name: mask for safe underground (single-bit governance per #30).
    -- Brave underground returns real leader name on RPL ID lookup.
    CASE
      WHEN c.type = 'underground' AND COALESCE(c.show_church_name, false) = false
        THEN NULL
      ELSE u.full_name
    END                                                               AS full_name,
    u.role::text                                                      AS role,
    u.anonymous                                                       AS anonymous,
    c.id                                                              AS church_id,
    -- church_name: respect show_church_name per #30.
    -- Brave underground → real church name.
    -- Safe underground → macro-region label (or 'Underground Church' fallback).
    -- Non-underground → real name.
    CASE
      WHEN c.type = 'underground' AND COALESCE(c.show_church_name, false) = true
        THEN c.name
      WHEN c.type = 'underground'
        THEN COALESCE(
               public.macro_region_label(c.region_admin_only),
               'Underground Church'
             )
      ELSE c.name
    END                                                               AS church_name,
    (c.type = 'underground')                                          AS underground
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.verification_status = 'verified'
    AND u.is_active = true
    AND c.is_active = true
    AND (v_caller_id IS NULL OR u.id <> v_caller_id)
    -- KAN-305: identity-known blocks suppress the directory (both directions);
    -- masked-context blocks do NOT (SEC §3.3 de-masking-oracle prevention).
    AND (v_caller_id IS NULL OR NOT public.fn_is_blocked_identity_known(v_caller_id, u.id))
    AND (
      -- RPL Network ID match — applies to ALL church types including underground.
      c.church_code ILIKE '%' || p_query || '%'
      -- Name match — surface (non-underground) leaders only (Day 5 ruling).
      OR (c.type <> 'underground' AND lower(u.full_name) LIKE '%' || v_q || '%')
    )
  ORDER BY u.full_name NULLS LAST
  LIMIT 30;
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_invite_candidates — resolve caller id and suppress identity-known
--   blocked pairs from the leaders agg AND the leader_count; drop ministries
--   emptied by that suppression via the existing HAVING. Masked-context blocks
--   do NOT suppress (SEC §3.3). Underground is already hard-excluded here.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invite_candidates(p_query text DEFAULT NULL::text)
 RETURNS TABLE(ministry_id uuid, ministry_name text, city text, country text, underground boolean, leader_count integer, leaders jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id     uuid;
  v_caller_church uuid;
  v_q             text := lower(trim(COALESCE(p_query, '')));
BEGIN
  SELECT id, church_id INTO v_caller_id, v_caller_church
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT
    c.id                                                              AS ministry_id,
    c.name                                                            AS ministry_name,
    c.city                                                            AS city,
    c.country                                                         AS country,
    false                                                             AS underground,
    COUNT(u.id)::int                                                  AS leader_count,
    jsonb_agg(
      jsonb_build_object(
        'user_id',   u.id,
        'full_name', u.full_name,
        'role',      u.role,
        'anonymous', u.anonymous
      )
      ORDER BY u.full_name
    )                                                                 AS leaders
  FROM public.churches c
  JOIN public.users u ON u.church_id = c.id
   AND u.is_active = true
   AND u.verification_status = 'verified'
   -- KAN-305: exclude identity-known blocked pairs from the candidate list
   -- (both directions). Masked-context blocks are not applied here (§3.3).
   AND (v_caller_id IS NULL OR NOT public.fn_is_blocked_identity_known(v_caller_id, u.id))
  WHERE c.is_active = true
    AND c.type <> 'underground'   -- HARD EXCLUDE underground from invite candidates
    AND c.id IS DISTINCT FROM v_caller_church
    AND (
      v_q = ''
      OR lower(c.name) LIKE '%' || v_q || '%'
    )
  GROUP BY c.id, c.type, c.name, c.city, c.country
  HAVING COUNT(u.id) > 0
  ORDER BY c.name
  LIMIT 50;
END;
$function$;

COMMIT;
