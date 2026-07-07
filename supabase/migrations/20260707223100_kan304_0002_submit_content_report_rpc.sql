-- KAN-304 — Leader-facing report mechanism
-- Migration 2/2: intake — fn_report_target_visible() helper + the
--                submit_content_report(...) SECURITY DEFINER RPC.
--
-- Depends on migration 1 (20260707223000): content_reports table, escalated_cases
-- additive columns, source_axis/escalation_reason/audit_log CHECK extensions.
--
-- House pattern (mirrors create_testimony / add_intercession_hold):
--   SECURITY DEFINER + SET search_path TO '' + fully-qualified names
--   + caller resolved via auth_id = auth.uid() (NOT id = auth.uid())
--   + REVOKE ALL FROM PUBLIC, anon + GRANT EXECUTE TO authenticated.
--
-- THE TWO NON-NEGOTIABLE INVARIANTS (SEC §1.1, §1.2; register §C invariants 1–2):
--   • ZERO content-row writes: this RPC touches NO messages/prayer_requests/
--     testimony/comments/churches row. It only READS them (for the visibility
--     re-assertion + the server-side snapshot) and writes content_reports +
--     audit_log + (on UG/safety) escalated_cases.
--   • UNIFORM intake response: the envelope the CLIENT sees is identical across
--     new / duplicate / invalid / not-visible-to-reporter — one shape,
--     {ok:true}. An invalid or not-visible target is discarded behind that same
--     success with a tier-gated forensic audit row (content_report_rejected) and
--     NO queue row — so the channel is never an existence / who-else-reported
--     oracle. The ONLY honest deviations are {error:'rate_limited'} (reporter's
--     OWN rate, not target-derived) and {error:'write_failed'} (a safety signal
--     must never be silently swallowed). not_authenticated/not_verified are
--     pre-intake auth failures, not target oracles.
--
-- RATE LIMITER: the fail-OPEN-alarmed Upstash limiter lives in the edge-function
-- wrapper (submit-report; register §C C-3 — a deliberate, ruled deviation from
-- signup's fail-closed). This RPC additionally carries a DB-side belt count
-- (primary bombing control is the partial-unique dedupe, which survives a Redis
-- outage). The edge fn passes p_ratelimit_ok so the RPC never has to reach Redis.

-- ============================================================================
-- 1. fn_report_target_visible — ONE place the per-surface visibility predicates
--    live (sister-action drift mitigation, BE §4.4). Mirrors the LIVE RLS/RPC
--    quals verbatim (verified 2026-07-07). SECURITY DEFINER: bypasses RLS so the
--    RPC re-asserts the *reporter's own* read rights, then returns resolved
--    author/church/snapshot for the caller RPC. Returns NULL when not visible.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_report_target_visible(
  p_reporter_id uuid,          -- public.users.id of the reporter
  p_target_type text,
  p_target_id   uuid
)
RETURNS TABLE (
  visible          boolean,
  target_author_id uuid,
  target_church_id uuid,
  content_snapshot text,
  attribution_meta jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_reporter_church uuid;
BEGIN
  SELECT u.church_id INTO v_reporter_church
  FROM public.users u WHERE u.id = p_reporter_id;

  -- Default: not visible. Each branch overwrites on a positive match only.
  visible := false;
  target_author_id := NULL;
  target_church_id := NULL;
  content_snapshot := NULL;
  attribution_meta := NULL;

  IF p_target_type = 'dm_message' THEN
    -- DM: reporter is a participant AND not their own message (§4.3). Since a
    -- reporter cannot report their own message, participation reduces to being the
    -- receiver of the DM (matches messages_select_own restricted by sender<>reporter).
    SELECT true, m.sender_id, su.church_id, m.content,
           jsonb_build_object('target_created_at', m.created_at,
                              'conversation_id', m.conversation_id,
                              'attribution_display_name', m.attribution_display_name)
      INTO visible, target_author_id, target_church_id, content_snapshot, attribution_meta
      FROM public.messages m
      JOIN public.users su ON su.id = m.sender_id
     WHERE m.id = p_target_id
       AND m.conversation_id IS NOT NULL
       AND m.sender_id <> p_reporter_id
       AND m.receiver_id = p_reporter_id;

  ELSIF p_target_type = 'branch_message' THEN
    -- Branch: reporter has a joined, non-left membership on the branch AND
    -- the message is active AND not their own.
    SELECT true, m.sender_id, su.church_id, m.content,
           jsonb_build_object('target_created_at', m.created_at,
                              'branch_id', m.branch_id,
                              'attribution_display_name', m.attribution_display_name)
      INTO visible, target_author_id, target_church_id, content_snapshot, attribution_meta
      FROM public.messages m
      JOIN public.users su ON su.id = m.sender_id
     WHERE m.id = p_target_id
       AND m.branch_id IS NOT NULL
       AND m.is_active = true
       AND m.sender_id <> p_reporter_id
       AND EXISTS (
         SELECT 1 FROM public.branch_members bm
          WHERE bm.branch_id = m.branch_id
            AND bm.user_id = p_reporter_id
            AND bm.consent_status = 'joined'
            AND bm.left_at IS NULL);

  ELSIF p_target_type = 'prayer_request' THEN
    -- Prayer: active AND network-visible AND not the reporter's own.
    -- Snapshot records anon-as-seen; author resolved for moderation regardless.
    SELECT true, pr.user_id, pr.church_id, pr.content,
           jsonb_build_object('target_created_at', pr.created_at,
                              'anonymous_as_seen', pr.anonymous)
      INTO visible, target_author_id, target_church_id, content_snapshot, attribution_meta
      FROM public.prayer_requests pr
     WHERE pr.id = p_target_id
       AND pr.is_active = true
       AND pr.user_id <> p_reporter_id;

  ELSIF p_target_type = 'testimony' THEN
    SELECT true, t.user_id, t.church_id, t.content,
           jsonb_build_object('target_created_at', t.created_at,
                              'anonymous_as_seen', t.anonymous)
      INTO visible, target_author_id, target_church_id, content_snapshot, attribution_meta
      FROM public.testimony t
     WHERE t.id = p_target_id
       AND t.is_active = true
       AND t.user_id <> p_reporter_id;

  ELSIF p_target_type = 'comment' THEN
    -- Comment: exists AND parent announcement published/active AND not own.
    -- comments has no soft-delete column — snapshot is load-bearing (hard-delete).
    SELECT true, c.author_id, au.church_id, c.body,
           jsonb_build_object('target_created_at', c.created_at,
                              'announcement_id', c.announcement_id,
                              'is_masked', c.is_masked,
                              'masked_region', c.masked_region)
      INTO visible, target_author_id, target_church_id, content_snapshot, attribution_meta
      FROM public.comments c
      JOIN public.users au ON au.id = c.author_id
      JOIN public.announcements a ON a.id = c.announcement_id
     WHERE c.id = p_target_id
       AND c.author_id <> p_reporter_id
       AND a.is_active = true
       AND a.published_at IS NOT NULL
       AND a.published_at <= now();

  ELSIF p_target_type = 'church_profile' THEN
    -- Church: browsable — active AND (not underground OR reporter's own church).
    -- No author; target_church_id is the church itself; snapshot is NULL (the
    -- profile is mutable and multi-field; snapshot_meta carries a field capture).
    SELECT true, NULL::uuid, ch.id, NULL::text,
           jsonb_build_object('church_type', ch.type::text,
                              'target_captured_at', now())
      INTO visible, target_author_id, target_church_id, content_snapshot, attribution_meta
      FROM public.churches ch
     WHERE ch.id = p_target_id
       AND ch.is_active = true
       AND (ch.type <> 'underground' OR ch.id = v_reporter_church);
  END IF;

  IF visible IS DISTINCT FROM true THEN
    visible := false;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_report_target_visible(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
-- Called only by submit_content_report (definer) — not client-callable.

-- ============================================================================
-- 2. submit_content_report — the intake RPC (audit-first, single transaction)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_content_report(
  p_target_type   text,            -- dm_message|branch_message|prayer_request|testimony|comment|church_profile
  p_target_id     uuid,
  p_reason_code   text,            -- locate_identify|threats|asking_for_money|impersonation|false_teaching|spam|wellbeing_concern|something_else
  p_detail        text DEFAULT NULL,
  p_ratelimit_ok  boolean DEFAULT true,  -- edge fn passes false only when its OWN limiter tripped (fail-open sets true)
  p_matched_codes text[] DEFAULT NULL    -- FLAG_TAXONOMY code NAMES from the edge fn's free-text scan (never patterns; AC-12).
                                         -- The TS matcher lives in the edge fn (_shared/taxonomy-codes.ts); Postgres has no
                                         -- matcher, so the scan is done edge-side and the code names passed in. NULL when the
                                         -- RPC is called directly (scan simply contributes nothing — DELIVER-ALWAYS).
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id        uuid := auth.uid();
  v_reporter_id    uuid;
  v_reporter_church uuid;
  v_reporter_ug    boolean := false;

  v_visible        boolean;
  v_author_id      uuid;
  v_target_church  uuid;
  v_snapshot       text;
  v_attr_meta      jsonb;

  v_author_ug      boolean := false;
  v_counterparty_ug boolean := false;
  v_church_ug      boolean := false;
  v_ug_involved    boolean := false;

  v_detail         text;
  v_matched        text[] := ARRAY[]::text[];
  v_safety_class   boolean := false;

  v_recent_count   integer := 0;
  v_burst_count    integer := 0;
  v_burst          boolean := false;

  v_existing_id    uuid;
  v_report_id      uuid;
  v_status         text := 'open';
  v_case_id        uuid;
  v_dedup          text := 'opened';
  v_conv_id        uuid;
  v_other_party    uuid;
BEGIN
  -- ── Auth: active + verified leader (mirrors messages_insert / create_testimony) ──
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.id, u.church_id
    INTO v_reporter_id, v_reporter_church
    FROM public.users u
   WHERE u.auth_id = v_auth_id
     AND u.is_active = true
     AND u.soft_deleted_at IS NULL
     AND u.verification_status = 'verified'
   LIMIT 1;

  IF v_reporter_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_verified');
  END IF;

  -- Resolve reporter-UG immediately: a UG reporter's id must never enter an
  -- any-admin-readable audit row — including rejection rows (SEC §3.3d). When the
  -- reporter is UG, EVERY audit row this RPC writes uses accessed_by=NULL,
  -- triggered_by='system', and omits church_id.
  SELECT (c.type = 'underground') INTO v_reporter_ug
    FROM public.churches c WHERE c.id = v_reporter_church;
  v_reporter_ug := COALESCE(v_reporter_ug, false);

  -- ── Rate limit (reporter's own — the ONE honest target-independent deviation).
  -- Edge fn is the primary (fail-open-alarmed). DB belt: >10 in trailing 24h.
  IF p_ratelimit_ok = false THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT count(*) INTO v_recent_count
    FROM public.content_reports cr
   WHERE cr.reporter_id = v_reporter_id
     AND cr.created_at > now() - interval '24 hours';
  IF v_recent_count >= 10 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- ── Validate reason_code + something_else free-text floor (before any target read).
  IF p_reason_code NOT IN ('locate_identify','threats','asking_for_money',
                           'impersonation','false_teaching','spam',
                           'wellbeing_concern','something_else') THEN
    -- Malformed client — treat as a rejected intake behind the uniform success.
    INSERT INTO public.audit_log (accessed_by, action, triggered_by, meta)
    VALUES (CASE WHEN v_reporter_ug THEN NULL ELSE v_reporter_id END,
            'content_report_rejected',
            CASE WHEN v_reporter_ug THEN 'system' ELSE 'user' END,
            jsonb_build_object('origin', 'leader_report',
                               'rejection', 'bad_reason_code',
                               'target_type', p_target_type));
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_detail := NULLIF(btrim(COALESCE(p_detail, '')), '');
  IF v_detail IS NOT NULL AND char_length(v_detail) > 500 THEN
    v_detail := left(v_detail, 500);   -- scrubAndCap: hard cap (watched-invariant #17)
  END IF;
  IF p_reason_code = 'something_else' AND v_detail IS NULL THEN
    -- something_else requires a description; a bare submit is malformed client.
    INSERT INTO public.audit_log (accessed_by, action, triggered_by, meta)
    VALUES (CASE WHEN v_reporter_ug THEN NULL ELSE v_reporter_id END,
            'content_report_rejected',
            CASE WHEN v_reporter_ug THEN 'system' ELSE 'user' END,
            jsonb_build_object('origin', 'leader_report',
                               'rejection', 'missing_detail_something_else',
                               'target_type', p_target_type));
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ── Visibility re-assertion (you can only report what you can see) ──
  SELECT t.visible, t.target_author_id, t.target_church_id, t.content_snapshot, t.attribution_meta
    INTO v_visible, v_author_id, v_target_church, v_snapshot, v_attr_meta
    FROM public.fn_report_target_visible(v_reporter_id, p_target_type, p_target_id) t;

  IF v_visible IS DISTINCT FROM true THEN
    -- Not-exists AND not-visible are INDISTINGUISHABLE to the client (§1.2):
    -- discard behind the uniform success + a tier-gated forensic row. NO queue row.
    INSERT INTO public.audit_log (accessed_by, action, triggered_by, meta)
    VALUES (CASE WHEN v_reporter_ug THEN NULL ELSE v_reporter_id END,
            'content_report_rejected',
            CASE WHEN v_reporter_ug THEN 'system' ELSE 'user' END,
            jsonb_build_object('origin', 'leader_report',
                               'rejection', 'target_not_visible',
                               'target_type', p_target_type,
                               'target_id', p_target_id));
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- ── Free-text scan result (from the edge fn; NAMES only, never patterns —
  -- AC-12 / SEC c.11750). A tier-1 hit dual-routes to safety (§4). The scan is
  -- advisory (DELIVER-ALWAYS) — absent/NULL contributes nothing.
  v_matched := COALESCE(p_matched_codes, ARRAY[]::text[]);

  -- ── UG-involvement: reporter (resolved early) OR author OR DM counterparty OR
  -- reported church. Resolved server-side, never trusting the client (§3.1;
  -- mirrors fn_auto_route_ug_*).
  IF v_author_id IS NOT NULL THEN
    SELECT (c.type = 'underground') INTO v_author_ug
      FROM public.users u JOIN public.churches c ON c.id = u.church_id
     WHERE u.id = v_author_id;
    v_author_ug := COALESCE(v_author_ug, false);
  END IF;

  IF p_target_type = 'dm_message' THEN
    -- DM counterparty = the other participant (not sender). Resolve from the row.
    SELECT m.conversation_id,
           CASE WHEN m.sender_id = v_reporter_id THEN m.receiver_id ELSE m.sender_id END
      INTO v_conv_id, v_other_party
      FROM public.messages m WHERE m.id = p_target_id;
    IF v_other_party IS NOT NULL THEN
      SELECT (c.type = 'underground') INTO v_counterparty_ug
        FROM public.users u JOIN public.churches c ON c.id = u.church_id
       WHERE u.id = v_other_party;
      v_counterparty_ug := COALESCE(v_counterparty_ug, false);
    END IF;
  END IF;

  IF p_target_type = 'church_profile' THEN
    SELECT (c.type = 'underground') INTO v_church_ug
      FROM public.churches c WHERE c.id = v_target_church;
    v_church_ug := COALESCE(v_church_ug, false);
  END IF;

  v_ug_involved := v_reporter_ug OR v_author_ug OR v_counterparty_ug OR v_church_ug;

  -- Safety class (always Escalated, two-person, regardless of UG): R1 always;
  -- R2 when the target is inside the reporter's OWN thread (direct threat); or a
  -- tier-1 free-text scan hit. Directness is decidable without content parsing.
  v_safety_class :=
       p_reason_code = 'locate_identify'
    OR (p_reason_code = 'threats' AND p_target_type IN ('dm_message','branch_message'))
    OR (v_matched && ARRAY['identity_probe','location_disclosure','opsec_violation',
                           'imminent_threat','duress_signal','recantation_pressure',
                           'urgent_safety_request']);

  -- ── Idempotency: existing OPEN report by this reporter on this target?
  SELECT cr.id INTO v_existing_id
    FROM public.content_reports cr
   WHERE cr.reporter_id = v_reporter_id
     AND cr.target_type = p_target_type
     AND cr.target_id = p_target_id
     AND cr.status = 'open';
  IF v_existing_id IS NOT NULL THEN
    -- Second tap = success, no new row, no second audit row (uniform "received").
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  -- ── Burst-shape cue (reviewer skepticism, never auto-actions content, §4.2):
  -- >=3 reports on this target inside 10 min, OR >=5 distinct reporters in 24h.
  SELECT count(*) INTO v_burst_count
    FROM public.content_reports cr
   WHERE cr.target_type = p_target_type AND cr.target_id = p_target_id
     AND cr.created_at > now() - interval '10 minutes';
  IF v_burst_count >= 2 THEN   -- this report makes 3
    v_burst := true;
  ELSE
    SELECT count(DISTINCT cr.reporter_id) INTO v_burst_count
      FROM public.content_reports cr
     WHERE cr.target_type = p_target_type AND cr.target_id = p_target_id
       AND cr.created_at > now() - interval '24 hours';
    IF v_burst_count >= 4 THEN  -- this report makes 5 distinct
      v_burst := true;
    END IF;
  END IF;

  -- ── Route.
  -- The locked escalated_cases_auto_route_consistency CHECK requires:
  --     auto_routed=true  ⇔ source_axis='auto_underground' AND escalated_by NULL
  --     auto_routed=false ⇔ source_axis<>'auto_underground' AND escalated_by NOT NULL
  -- At intake there is NO acting admin, so the ONLY CHECK-valid system-created
  -- case is the auto_underground shape. Therefore:
  --   • UG-involved report  → auto_underground system case NOW (born escalated),
  --     dedupe-or-create; message targets also set source_message_id so the live
  --     v_escalated_inbox joins light up, non-message targets use source_target_*.
  --   • Non-UG safety-class report (R1 / own-thread R2 / tier-1 scan) → cannot mint
  --     a CHECK-valid case without an admin (reporter is never an admin-provenance
  --     value, SEC §3.2). It is born 'open' with burst_flagged=true + a SAFETY cue
  --     in snapshot_meta/audit so it sorts to the TOP of the regular queue, and the
  --     admin escalate RPC (which has an acting admin) opens the source_axis='report'
  --     case for two-person handling. Reasoned deviation from MOD §4's "R1 auto-opens
  --     Escalated directly" for the NON-UG case only — logged in the deviations note;
  --     the safety signal is not lost, only routed via the top of the regular queue.
  IF v_ug_involved THEN
    -- Dedupe-or-create the auto_underground system case (CHECK-clean).
    SELECT ec.id INTO v_case_id
      FROM public.escalated_cases ec
     WHERE ec.state <> 'closed'
       AND ((p_target_type IN ('dm_message','branch_message') AND ec.source_message_id = p_target_id)
            OR (ec.source_target_type = p_target_type AND ec.source_target_id = p_target_id))
     LIMIT 1;

    IF v_case_id IS NULL THEN
      INSERT INTO public.escalated_cases (
        source_axis, source_message_id, source_target_type, source_target_id,
        report_snapshot_content, report_snapshot_meta,
        leader_user_id, receiver_user_id,
        state, escalation_reason, escalation_context,
        escalated_by_user_id, escalated_by_tier, auto_routed
      ) VALUES (
        'auto_underground',
        CASE WHEN p_target_type IN ('dm_message','branch_message') THEN p_target_id ELSE NULL END,
        p_target_type, p_target_id,
        v_snapshot, v_attr_meta,
        v_author_id, v_other_party,
        'open', 'auto_underground',
        'Underground party involved in a leader report — auto-routed past regular queues.',
        NULL, NULL, true
      )
      RETURNING id INTO v_case_id;

      INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
      VALUES ('escalated_case_auto_routed', NULL, 'system',
              jsonb_build_object('origin', 'leader_report',
                                 'source', 'rpc:submit_content_report',
                                 'source_target_type', p_target_type,
                                 'source_target_id', p_target_id,
                                 'source_axis', 'report_ug'));
    END IF;

    v_status := 'escalated';
  ELSE
    -- Non-UG (incl. non-UG safety-class): born 'open'. Safety class is carried in
    -- burst_flagged + audit so the admin queue surfaces it first for two-person
    -- handling; the admin escalate RPC opens the source_axis='report' case.
    v_status := 'open';
    IF v_safety_class THEN
      v_burst := true;   -- ensure safety-class sorts to the top of the queue cue
    END IF;
  END IF;

  -- ── Insert the report row. Idempotency belt: ON CONFLICT on the partial-unique
  -- open-per-reporter-target index (a race between the SELECT above and here).
  INSERT INTO public.content_reports (
    reporter_id, target_type, target_id,
    target_author_id, target_church_id,
    reason_code, detail,
    content_snapshot, snapshot_meta,
    ug_involved, status, case_id, burst_flagged
  ) VALUES (
    v_reporter_id, p_target_type, p_target_id,
    v_author_id, v_target_church,
    p_reason_code, v_detail,
    v_snapshot,
    COALESCE(v_attr_meta, '{}'::jsonb) || jsonb_build_object('matched_codes', to_jsonb(v_matched),
                                                             'safety_class', v_safety_class),
    v_ug_involved, v_status, v_case_id, v_burst
  )
  ON CONFLICT (reporter_id, target_type, target_id) WHERE (status = 'open')
  DO NOTHING
  RETURNING id INTO v_report_id;

  IF v_report_id IS NULL THEN
    -- Lost the race — an open report already exists. Uniform success.
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  IF v_case_id IS NOT NULL THEN
    v_dedup := 'attached_to_case';
  END IF;

  -- ── Audit-first-in-transaction (SEC §7.2). If this INSERT fails, the whole
  -- transaction (report row included) rolls back — a safety signal is never
  -- half-committed. For UG-involved rows, meta carries NO reporter/author id and
  -- NO UG marker (the audit page is any-admin-readable, §3.3d): identity
  -- resolution requires the tier-gated content_reports table.
  INSERT INTO public.audit_log (accessed_by, action, triggered_by, church_id, meta)
  VALUES (
    CASE WHEN v_ug_involved THEN NULL ELSE v_reporter_id END,
    'content_report_submitted',
    CASE WHEN v_ug_involved THEN 'system' ELSE 'user' END,
    CASE WHEN v_ug_involved THEN NULL ELSE v_reporter_church END,
    CASE WHEN v_ug_involved THEN
      jsonb_build_object('origin', 'leader_report', 'report_id', v_report_id,
                         'target_type', p_target_type, 'dedup', v_dedup,
                         'routed', 'escalated')
    ELSE
      jsonb_build_object('origin', 'leader_report', 'report_id', v_report_id,
                         'target_type', p_target_type, 'reason', p_reason_code,
                         'dedup', v_dedup, 'ug_involved', false,
                         'safety_class', v_safety_class, 'burst_flagged', v_burst,
                         'routed', v_status)
    END
  );

  -- Uniform success envelope (client renders "Report received." for every shape).
  RETURN jsonb_build_object('ok', true, 'duplicate', false);

EXCEPTION
  WHEN OTHERS THEN
    -- A genuine write failure is the ONE case we surface honestly — a dropped
    -- safety report is the worse failure (§7.4). No partial state (transaction
    -- rolls back). The edge fn maps this to a retryable client error.
    RETURN jsonb_build_object('error', 'write_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_content_report(text, uuid, text, text, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_content_report(text, uuid, text, text, boolean, text[]) TO authenticated;

COMMENT ON FUNCTION public.submit_content_report(text, uuid, text, text, boolean, text[]) IS
  'KAN-304 report intake. Uniform {ok:true} across new/duplicate/invalid/not-visible (anti-oracle); only {error:rate_limited} and {error:write_failed} deviate. Zero content-row writes. UG-involved (reporter/author/counterparty/church) born escalated via auto_underground system case; non-UG safety-class born open+flagged for admin two-person escalation. Audit-first in one transaction.';

-- ── End of migration 2/2. ──
