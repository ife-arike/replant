-- KAN-293/295/296/292 — Fix trigger audit inserts to use canonical triggered_by='system'
--
-- audit_log_triggered_by_check only accepts ('user','cron','system','webhook');
-- 20260701000003 initial version wrote 'trigger:fn_...' which violates the CHECK
-- and would 23514 on first real trigger fire. Migration identity moves to meta.source.
--
-- This corrective migration ships with the initial three because we discovered
-- the constraint during Migration 6 backfill. Both trigger functions get replaced
-- in-place; the trigger definitions themselves (trg_auto_route_ug_flagged /
-- trg_auto_route_ug_pastoral) don't need to be recreated.

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
