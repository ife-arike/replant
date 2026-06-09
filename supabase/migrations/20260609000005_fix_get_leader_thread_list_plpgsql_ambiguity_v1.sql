-- 20260609000005_fix_get_leader_thread_list_plpgsql_ambiguity_v1.sql
--
-- ROOT CAUSE: PL/pgSQL RETURNS TABLE(conversation_id uuid, ...) creates
-- implicit OUT parameters with those column names. Inside the function body,
-- unqualified references like `SELECT conversation_id FROM conv_rows` are
-- seen by the planner as ambiguous between the CTE column and the OUT
-- parameter — hence "column reference 'conversation_id' is ambiguous".
--
-- The direct SQL test worked because it ran outside PL/pgSQL scope.
-- The fix: alias both CTEs in the UNION ALL inner SELECTs (cr/rr) and
-- qualify every column reference with the alias so the planner resolves
-- against the CTE row, not the OUT parameter.

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
      m.conversation_id AS msg_conv_id, m.content, m.created_at
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT t.id FROM my_threads t)
      AND m.is_active = true
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  conv_rows AS (
    SELECT
      t.id                                                              AS c_conversation_id,
      t.other_id                                                        AS c_other_user_id,
      CASE WHEN t.is_secure_replant_thread THEN 'Replant Team'
           ELSE u.full_name END                                         AS c_other_full_name,
      u.display_name_preference                                         AS c_other_display_name_preference,
      COALESCE(u.role::text, 'system')                                  AS c_other_role,
      COALESCE(u.anonymous, false)                                      AS c_other_anonymous,
      u.church_id                                                       AS c_other_church_id,
      CASE WHEN t.is_secure_replant_thread THEN NULL
           WHEN ch.type = 'underground' THEN 'Underground Church'
           ELSE ch.name END                                             AS c_other_church_name,
      COALESCE(ch.type = 'underground', false)                          AS c_other_underground,
      t.is_secure_replant_thread                                        AS c_is_secure,
      LEFT(lm.content, 60)                                              AS c_preview,
      lm.created_at                                                     AS c_last_at,
      (
        SELECT COUNT(*) FROM public.messages m2
        WHERE m2.conversation_id = t.id
          AND m2.is_active = true
          AND m2.sender_id <> v_caller_id
          AND (t.my_last_read_at IS NULL OR m2.created_at > t.my_last_read_at)
      )                                                                 AS c_unread,
      CASE WHEN t.is_secure_replant_thread THEN 1 ELSE 0 END           AS c_sort_secure
    FROM my_threads t
    LEFT JOIN public.users    u  ON u.id  = t.other_id
    LEFT JOIN public.churches ch ON ch.id = u.church_id
    LEFT JOIN last_msg        lm ON lm.msg_conv_id = t.id
  ),
  -- ---- request rows (caller is sender OR recipient) ----------------------
  req_rows AS (
    SELECT
      CASE WHEN cr.sender_id = v_caller_id
           THEN cr.recipient_id ELSE cr.sender_id END                   AS r_other_user_id,
      ou.full_name                                                      AS r_other_full_name,
      ou.display_name_preference                                        AS r_other_display_name_preference,
      COALESCE(ou.role::text, 'system')                                 AS r_other_role,
      COALESCE(ou.anonymous, false)                                     AS r_other_anonymous,
      ou.church_id                                                      AS r_other_church_id,
      CASE WHEN och.type = 'underground' THEN 'Underground Church'
           ELSE och.name END                                            AS r_other_church_name,
      COALESCE(och.type = 'underground', false)                         AS r_other_underground,
      LEFT(cr.message, 60)                                              AS r_preview,
      cr.sent_at                                                        AS r_last_at,
      CASE
        WHEN cr.recipient_id = v_caller_id AND cr.status = 'pending'
          THEN 1::bigint
        ELSE 0::bigint
      END                                                               AS r_unread,
      CASE
        WHEN cr.recipient_id = v_caller_id AND cr.status = 'pending' THEN 'request_incoming'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'pending'  THEN 'request_pending'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'declined' THEN 'request_declined'
        WHEN cr.sender_id   = v_caller_id AND cr.status = 'expired'  THEN 'request_expired'
      END                                                               AS r_row_kind,
      cr.id                                                             AS r_request_id,
      cr.sent_at                                                        AS r_request_sent_at,
      cr.sent_at                                                        AS r_sent_at,
      cr.declined_at                                                    AS r_declined_at,
      cr.expires_at                                                     AS r_expires_at
    FROM public.connection_requests cr
    LEFT JOIN public.users    ou  ON ou.id  =
      CASE WHEN cr.sender_id = v_caller_id THEN cr.recipient_id ELSE cr.sender_id END
    LEFT JOIN public.churches och ON och.id = ou.church_id
    WHERE
      (cr.recipient_id = v_caller_id AND cr.status = 'pending')
      OR
      (cr.sender_id = v_caller_id AND cr.status IN ('pending','declined','expired'))
  )
  -- ---- unify + order (all columns fully qualified to avoid OUT-param clash)
  SELECT
    x.conv_id,
    x.ou_id,
    x.ou_full_name,
    x.ou_display_pref,
    x.ou_role,
    x.ou_anon,
    x.ou_church_id,
    x.ou_church_name,
    x.ou_underground,
    x.is_secure,
    x.preview,
    x.last_at,
    x.unread,
    x.rk,
    x.req_id,
    x.req_sent_at
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
        WHEN cr.c_is_secure  THEN 0
        WHEN cr.c_unread > 0 THEN 2
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
      rr.r_other_user_id     AS ou_id,
      rr.r_other_full_name   AS ou_full_name,
      rr.r_other_display_name_preference AS ou_display_pref,
      rr.r_other_role        AS ou_role,
      rr.r_other_anonymous   AS ou_anon,
      rr.r_other_church_id   AS ou_church_id,
      rr.r_other_church_name AS ou_church_name,
      rr.r_other_underground AS ou_underground,
      false                  AS is_secure,
      rr.r_preview           AS preview,
      rr.r_last_at           AS last_at,
      rr.r_unread            AS unread,
      rr.r_row_kind          AS rk,
      rr.r_request_id        AS req_id,
      rr.r_request_sent_at   AS req_sent_at,
      0                      AS sort_secure,
      CASE
        WHEN rr.r_row_kind = 'request_incoming' THEN 1
        WHEN rr.r_row_kind = 'request_pending'  THEN 4
        WHEN rr.r_row_kind = 'request_declined' THEN 5
        WHEN rr.r_row_kind = 'request_expired'  THEN 6
        ELSE 9
      END                    AS grp,
      NULL::timestamptz      AS conv_at,
      rr.r_sent_at           AS r_sent,
      rr.r_declined_at       AS r_declined,
      rr.r_expires_at        AS r_expires
    FROM req_rows rr
  ) x
  ORDER BY
    x.grp ASC,
    COALESCE(x.conv_at,    '1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_sent,     '1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_declined, '1970-01-01'::timestamptz) DESC,
    COALESCE(x.r_expires,  '1970-01-01'::timestamptz) DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_leader_thread_list() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_leader_thread_list() TO authenticated;
