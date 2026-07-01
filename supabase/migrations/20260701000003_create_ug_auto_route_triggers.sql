-- KAN-293/295/296/292 — UG auto-route triggers
--
-- Two triggers that push UG-touched messages into escalated_cases at write-time
-- so UG content NEVER lands on /pastoral or /flagged for non-UG admins to see.
--
-- Idempotency: both triggers check for existing escalated_cases row on the
-- source_message_id before inserting, so re-running the flip is a no-op.
--
-- Audit: every auto-route writes an 'escalated_case_auto_routed' row with
-- accessed_by=NULL and triggered_by='trigger:<fn_name>'.

-- ============================================================================
-- Trigger 1: Flagged axis — fires when messages.flag_status flips to 'escalated'
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_route_ug_flagged()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender_ug boolean;
  v_receiver_ug boolean;
  v_existing uuid;
BEGIN
  IF NEW.flag_status IS DISTINCT FROM 'escalated' THEN RETURN NEW; END IF;
  IF OLD.flag_status = 'escalated' THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM escalated_cases WHERE source_message_id = NEW.id;
  IF FOUND THEN RETURN NEW; END IF;

  SELECT (c.type = 'underground') INTO v_sender_ug
    FROM users u JOIN churches c ON c.id = u.church_id
    WHERE u.id = NEW.sender_id;
  SELECT (c.type = 'underground') INTO v_receiver_ug
    FROM users u JOIN churches c ON c.id = u.church_id
    WHERE u.id = NEW.receiver_id;

  IF COALESCE(v_sender_ug, false) OR COALESCE(v_receiver_ug, false) THEN
    INSERT INTO escalated_cases (
      source_axis, source_message_id, leader_user_id, receiver_user_id,
      state, escalation_reason, escalation_context,
      escalated_by_user_id, escalated_by_tier, auto_routed
    ) VALUES (
      'auto_underground', NEW.id, NEW.sender_id, NEW.receiver_id,
      'open', 'auto_underground',
      'Underground party in this exchange — auto-routed past Flagged.',
      NULL, NULL, true
    );

    INSERT INTO audit_log (action, accessed_by, triggered_by, meta) VALUES (
      'escalated_case_auto_routed', NULL, 'system',
      jsonb_build_object(
        'source', 'trigger:fn_auto_route_ug_flagged',
        'message_id', NEW.id,
        'sender_ug', v_sender_ug,
        'receiver_ug', v_receiver_ug,
        'source_axis', 'flagged'
      )
    );
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_auto_route_ug_flagged
  AFTER UPDATE OF flag_status ON public.messages
  FOR EACH ROW EXECUTE FUNCTION fn_auto_route_ug_flagged();

-- ============================================================================
-- Trigger 2: Pastoral axis — fires when moderation_state.status flips to
-- 'escalated' AND axis='admin'.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_route_ug_pastoral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg messages%ROWTYPE;
  v_sender_ug boolean;
  v_receiver_ug boolean;
  v_existing uuid;
BEGIN
  IF NEW.axis <> 'admin' OR NEW.status IS DISTINCT FROM 'escalated' THEN RETURN NEW; END IF;
  IF OLD.status = 'escalated' THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM escalated_cases WHERE source_message_id = NEW.message_id;
  IF FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_msg FROM messages WHERE id = NEW.message_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT (c.type = 'underground') INTO v_sender_ug
    FROM users u JOIN churches c ON c.id = u.church_id WHERE u.id = v_msg.sender_id;
  SELECT (c.type = 'underground') INTO v_receiver_ug
    FROM users u JOIN churches c ON c.id = u.church_id WHERE u.id = v_msg.receiver_id;

  IF COALESCE(v_sender_ug, false) OR COALESCE(v_receiver_ug, false) THEN
    INSERT INTO escalated_cases (
      source_axis, source_message_id, leader_user_id, receiver_user_id,
      state, escalation_reason, escalation_context,
      escalated_by_user_id, escalated_by_tier, auto_routed
    ) VALUES (
      'auto_underground', v_msg.id, v_msg.sender_id, v_msg.receiver_id,
      'open', 'auto_underground',
      'Underground party in this exchange — auto-routed past Pastoral.',
      NULL, NULL, true
    );

    INSERT INTO audit_log (action, accessed_by, triggered_by, meta) VALUES (
      'escalated_case_auto_routed', NULL, 'system',
      jsonb_build_object(
        'source', 'trigger:fn_auto_route_ug_pastoral',
        'message_id', v_msg.id,
        'sender_ug', v_sender_ug,
        'receiver_ug', v_receiver_ug,
        'source_axis', 'pastoral'
      )
    );
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_auto_route_ug_pastoral
  AFTER UPDATE OF status ON public.moderation_state
  FOR EACH ROW EXECUTE FUNCTION fn_auto_route_ug_pastoral();
