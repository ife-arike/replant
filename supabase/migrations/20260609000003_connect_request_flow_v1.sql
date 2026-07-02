-- 20260609000003_connect_request_flow_v1.sql
-- Connect tab message-request consent layer.
--
-- Adds public.connection_requests, RLS, 5 SECURITY DEFINER RPCs, and replaces
-- get_leader_thread_list with a version that UNIONs conversations + requests.
--
-- Covering prayer offered before authoring. Replant is a secure communication
-- platform for Christian leaders globally; this consent layer guards the
-- vulnerable so no leader receives unwanted contact without consent.

-- =========================================================================
-- 1. TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      uuid        NOT NULL REFERENCES public.users(id),
  recipient_id   uuid        NOT NULL REFERENCES public.users(id),
  message        text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','accepted','declined','withdrawn','expired')),
  sent_at        timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  declined_at    timestamptz,
  expires_at     timestamptz NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  CONSTRAINT no_self_request CHECK (sender_id <> recipient_id)
);

-- Only one active pending request per (sender, recipient) pair at a time.
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_one_pending_per_pair
  ON public.connection_requests (sender_id, recipient_id)
  WHERE status = 'pending';

-- Lookup helpers for thread-list assembly and cooldown checks.
CREATE INDEX IF NOT EXISTS connection_requests_sender_status_idx
  ON public.connection_requests (sender_id, status);
CREATE INDEX IF NOT EXISTS connection_requests_recipient_status_idx
  ON public.connection_requests (recipient_id, status);
CREATE INDEX IF NOT EXISTS connection_requests_expiry_idx
  ON public.connection_requests (expires_at) WHERE status = 'pending';

-- =========================================================================
-- 2. RLS
-- =========================================================================
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_requests FORCE ROW LEVEL SECURITY;

-- Sender can read their own outgoing requests in any status.
DROP POLICY IF EXISTS connection_requests_sender_select ON public.connection_requests;
CREATE POLICY connection_requests_sender_select
  ON public.connection_requests
  FOR SELECT
  USING (
    sender_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Recipient can read incoming requests only while still pending.
-- Once resolved (declined/expired/withdrawn/accepted) the row is no longer
-- visible to the recipient; declined/expired state remains visible to sender.
DROP POLICY IF EXISTS connection_requests_recipient_select ON public.connection_requests;
CREATE POLICY connection_requests_recipient_select
  ON public.connection_requests
  FOR SELECT
  USING (
    status = 'pending'
    AND recipient_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- No direct INSERT/UPDATE/DELETE from clients. All writes flow through the
-- SECURITY DEFINER RPCs below. (No INSERT/UPDATE/DELETE policies => denied.)

-- =========================================================================
-- 3. RPC: send_connection_request
-- =========================================================================
CREATE OR REPLACE FUNCTION public.send_connection_request(
  p_recipient_id uuid,
  p_message      text
)
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
  -- Resolve + verify caller.
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

  -- Recipient must be verified + active.
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

  -- No existing pending request in EITHER direction.
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

  -- No existing conversation between this pair (deterministic sorted pair).
  v_a := LEAST(v_caller_id, p_recipient_id);
  v_b := GREATEST(v_caller_id, p_recipient_id);
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE participant_a = v_a AND participant_b = v_b
  ) THEN
    RAISE EXCEPTION 'conversation_exists';
  END IF;

  -- 30-day cooldown: no declined request from THIS sender -> recipient
  -- declined within the last 30 days.
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

-- =========================================================================
-- 4. RPC: respond_to_connection_request
-- =========================================================================
CREATE OR REPLACE FUNCTION public.respond_to_connection_request(
  p_request_id uuid,
  p_action     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_req public.connection_requests%ROWTYPE;
  v_a uuid;
  v_b uuid;
  v_conv_id uuid;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_action NOT IN ('accept','decline') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  -- Lock the request row to avoid concurrent double-response.
  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
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

  -- accept --------------------------------------------------------------
  v_a := LEAST(v_req.sender_id, v_req.recipient_id);
  v_b := GREATEST(v_req.sender_id, v_req.recipient_id);

  -- Reuse an existing conversation for the pair if one somehow exists,
  -- otherwise create it.
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

  -- Seed the conversation with the original request message.
  INSERT INTO public.messages (sender_id, receiver_id, content, conversation_id, is_active, flagged)
  VALUES (v_req.sender_id, v_req.recipient_id, v_req.message, v_conv_id, true, false);

  UPDATE public.connection_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = v_req.id;

  RETURN v_conv_id;
END;
$function$;

-- =========================================================================
-- 5. RPC: withdraw_connection_request  (sender, pending only)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.withdraw_connection_request(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_req public.connection_requests%ROWTYPE;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_req.sender_id <> v_caller_id THEN
    RAISE EXCEPTION 'not_sender';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  -- No age gate (Founder ruling): withdraw available any time server-side;
  -- the 3-day "withdraw" affordance is a FE presentation rule only.
  UPDATE public.connection_requests
  SET status = 'withdrawn', responded_at = now()
  WHERE id = v_req.id;
END;
$function$;

-- =========================================================================
-- 6. RPC: remove_connection_request  (sender; declined/expired/withdrawn)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.remove_connection_request(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_req public.connection_requests%ROWTYPE;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_req.sender_id <> v_caller_id THEN
    RAISE EXCEPTION 'not_sender';
  END IF;
  IF v_req.status NOT IN ('declined','expired','withdrawn') THEN
    RAISE EXCEPTION 'request_not_removable';
  END IF;

  DELETE FROM public.connection_requests WHERE id = v_req.id;
END;
$function$;

-- =========================================================================
-- 7. RPC: expire_pending_requests  (no auth; job / on-read)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.expire_pending_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.connection_requests
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$function$;

-- =========================================================================
-- 8. get_leader_thread_list  (conversations UNION connection_requests)
-- =========================================================================
DROP FUNCTION IF EXISTS public.get_leader_thread_list();

CREATE OR REPLACE FUNCTION public.get_leader_thread_list()
RETURNS TABLE(
  conversation_id                 uuid,
  other_user_id                   uuid,
  other_full_name                 text,
  other_display_name_preference   text,
  other_role                      text,
  other_anonymous                 boolean,
  other_church_id                 uuid,
  other_church_name               text,
  other_underground               boolean,
  is_secure_replant_thread        boolean,
  last_message_preview            text,
  last_message_at                 timestamptz,
  unread_count                    bigint,
  row_kind                        text,
  request_id                      uuid,
  request_sent_at                 timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_ignore integer;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Keep expiry fresh on every read (no cron needed).
  v_ignore := public.expire_pending_requests();

  RETURN QUERY
  WITH
  -- ---- conversation rows -------------------------------------------------
  my_threads AS (
    SELECT c.id, c.participant_a, c.participant_b,
           c.is_secure_replant_thread,
           CASE WHEN c.participant_a = v_caller_id
                THEN c.last_read_at_a ELSE c.last_read_at_b END AS my_last_read_at,
           CASE WHEN c.participant_a = v_caller_id
                THEN c.participant_b ELSE c.participant_a END AS other_id
    FROM public.conversations c
    WHERE c.participant_a = v_caller_id OR c.participant_b = v_caller_id
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id, m.content, m.created_at
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM my_threads)
      AND m.is_active = true
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  conv_rows AS (
    SELECT
      t.id                                                              AS conversation_id,
      t.other_id                                                        AS other_user_id,
      CASE WHEN t.is_secure_replant_thread THEN 'Replant Team'
           ELSE u.full_name END                                         AS other_full_name,
      u.display_name_preference                                         AS other_display_name_preference,
      COALESCE(u.role::text, 'system')                                  AS other_role,
      COALESCE(u.anonymous, false)                                      AS other_anonymous,
      u.church_id                                                       AS other_church_id,
      CASE WHEN t.is_secure_replant_thread THEN NULL
           WHEN ch.type = 'underground' THEN 'Underground Church'
           ELSE ch.name END                                             AS other_church_name,
      COALESCE(ch.type = 'underground', false)                          AS other_underground,
      t.is_secure_replant_thread                                        AS is_secure_replant_thread,
      LEFT(lm.content, 60)                                              AS last_message_preview,
      lm.created_at                                                     AS last_message_at,
      (
        SELECT COUNT(*) FROM public.messages m
        WHERE m.conversation_id = t.id
          AND m.is_active = true
          AND m.sender_id <> v_caller_id
          AND (t.my_last_read_at IS NULL OR m.created_at > t.my_last_read_at)
      )                                                                 AS unread_count,
      'conversation'::text                                              AS row_kind,
      NULL::uuid                                                        AS request_id,
      NULL::timestamptz                                                 AS request_sent_at,
      -- sort helpers
      CASE WHEN t.is_secure_replant_thread THEN 1 ELSE 0 END           AS sort_secure,
      lm.created_at                                                     AS sort_conv_at
    FROM my_threads t
    LEFT JOIN public.users    u  ON u.id  = t.other_id
    LEFT JOIN public.churches ch ON ch.id = u.church_id
    LEFT JOIN last_msg        lm ON lm.conversation_id = t.id
  ),
  -- ---- request rows (caller is sender OR recipient) ----------------------
  req_rows AS (
    SELECT
      NULL::uuid                                                        AS conversation_id,
      CASE WHEN cr.sender_id = v_caller_id
           THEN cr.recipient_id ELSE cr.sender_id END                   AS other_user_id,
      ou.full_name                                                      AS other_full_name,
      ou.display_name_preference                                        AS other_display_name_preference,
      COALESCE(ou.role::text, 'system')                                 AS other_role,
      COALESCE(ou.anonymous, false)                                     AS other_anonymous,
      ou.church_id                                                      AS other_church_id,
      CASE WHEN och.type = 'underground' THEN 'Underground Church'
           ELSE och.name END                                            AS other_church_name,
      COALESCE(och.type = 'underground', false)                         AS other_underground,
      false                                                             AS is_secure_replant_thread,
      LEFT(cr.message, 60)                                              AS last_message_preview,
      cr.sent_at                                                        AS last_message_at,
      CASE
        WHEN cr.recipient_id = v_caller_id AND cr.status = 'pending'
          THEN 1::bigint            -- incoming pending drives unread dot
        ELSE 0::bigint
      END                                                               AS unread_count,
      CASE
        WHEN cr.recipient_id = v_caller_id AND cr.status = 'pending' THEN 'request_incoming'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'pending'  THEN 'request_pending'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'declined' THEN 'request_declined'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'expired'  THEN 'request_expired'
      END                                                               AS row_kind,
      cr.id                                                             AS request_id,
      cr.sent_at                                                        AS request_sent_at,
      0                                                                 AS sort_secure,
      NULL::timestamptz                                                 AS sort_conv_at,
      cr.status                                                         AS req_status,
      cr.sent_at                                                        AS req_sent_at,
      cr.declined_at                                                    AS req_declined_at,
      cr.expires_at                                                     AS req_expires_at
    FROM public.connection_requests cr
    LEFT JOIN public.users    ou  ON ou.id  =
      CASE WHEN cr.sender_id = v_caller_id THEN cr.recipient_id ELSE cr.sender_id END
    LEFT JOIN public.churches och ON och.id = ou.church_id
    WHERE
      -- incoming: caller is recipient, still pending
      (cr.recipient_id = v_caller_id AND cr.status = 'pending')
      OR
      -- outgoing: caller is sender, pending/declined/expired (NOT withdrawn/accepted)
      (cr.sender_id = v_caller_id AND cr.status IN ('pending','declined','expired'))
  )
  -- ---- unify + order -----------------------------------------------------
  SELECT
    x.conversation_id,
    x.other_user_id,
    x.other_full_name,
    x.other_display_name_preference,
    x.other_role,
    x.other_anonymous,
    x.other_church_id,
    x.other_church_name,
    x.other_underground,
    x.is_secure_replant_thread,
    x.last_message_preview,
    x.last_message_at,
    x.unread_count,
    x.row_kind,
    x.request_id,
    x.request_sent_at
  FROM (
    SELECT
      conversation_id, other_user_id, other_full_name, other_display_name_preference,
      other_role, other_anonymous, other_church_id, other_church_name, other_underground,
      is_secure_replant_thread, last_message_preview, last_message_at, unread_count,
      row_kind, request_id, request_sent_at,
      sort_secure,
      -- group priority for ordering
      CASE
        WHEN is_secure_replant_thread                       THEN 0
        WHEN row_kind = 'conversation' AND unread_count > 0 THEN 2
        WHEN row_kind = 'conversation'                      THEN 3
        WHEN row_kind = 'request_pending'                   THEN 4
        WHEN row_kind = 'request_declined'                  THEN 5
        WHEN row_kind = 'request_expired'                   THEN 6
        ELSE 9
      END                                                               AS grp,
      last_message_at                                                   AS conv_at,
      NULL::timestamptz                                                 AS r_sent,
      NULL::timestamptz                                                 AS r_declined,
      NULL::timestamptz                                                 AS r_expires
    FROM conv_rows
    UNION ALL
    SELECT
      conversation_id, other_user_id, other_full_name, other_display_name_preference,
      other_role, other_anonymous, other_church_id, other_church_name, other_underground,
      is_secure_replant_thread, last_message_preview, last_message_at, unread_count,
      row_kind, request_id, request_sent_at,
      sort_secure,
      CASE
        WHEN row_kind = 'request_incoming'                  THEN 1
        WHEN row_kind = 'request_pending'                   THEN 4
        WHEN row_kind = 'request_declined'                  THEN 5
        WHEN row_kind = 'request_expired'                   THEN 6
        ELSE 9
      END                                                               AS grp,
      NULL::timestamptz                                                 AS conv_at,
      req_sent_at                                                       AS r_sent,
      req_declined_at                                                   AS r_declined,
      req_expires_at                                                    AS r_expires
    FROM req_rows
  ) x
  ORDER BY
    x.grp ASC,
    -- within conversation groups: newest first
    COALESCE(x.conv_at, '1970-01-01'::timestamptz) DESC,
    -- within request groups: newest relevant timestamp first
    COALESCE(x.r_sent, '1970-01-01'::timestamptz)     DESC,
    COALESCE(x.r_declined, '1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_expires, '1970-01-01'::timestamptz)  DESC;
END;
$function$;

-- =========================================================================
-- 9. GRANTS
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.send_connection_request(uuid, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_connection_request(uuid, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_connection_request(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_connection_request(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_requests()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leader_thread_list()                     TO authenticated;
