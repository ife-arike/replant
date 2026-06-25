-- KAN-271 / Workstream A — 48h TTL sweeper for pending promotion requests
-- (manifest ratification A-#3). Runs every 4h via pg_cron — promotions are
-- time-sensitive but not minute-sensitive.
--
-- DESIGN NOTE: trigger trg_admin_tier_promotions_no_terminal_update blocks
-- UPDATEs to rows ALREADY in terminal state, but allows pending → expired
-- (its OLD.state check returns NEW for pending OLD). Safe.
--
-- Applied to remote via MCP apply_migration on 2026-06-24.

CREATE OR REPLACE FUNCTION public.fn_expire_pending_admin_promotions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_row RECORD; v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, candidate_user_id, sponsor_user_id
      FROM public.admin_tier_promotions
      WHERE state = 'pending' AND expires_at <= now()
      FOR UPDATE
  LOOP
    UPDATE public.admin_tier_promotions
      SET state = 'expired', resolved_at = now()
      WHERE id = v_row.id;

    INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
      VALUES ('admin_tier_promotion_expired', NULL, 'cron'::text,
              jsonb_build_object('promotion_id', v_row.id,
                                 'candidate_user_id', v_row.candidate_user_id,
                                 'sponsor_user_id', v_row.sponsor_user_id));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_expire_pending_admin_promotions() TO authenticated;

-- pg_cron — every 4 hours. Idempotent: drop prior schedule if it exists.
DO $$
DECLARE v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'admin_tier_promotions_expire_4h';
  IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
END$$;

SELECT cron.schedule(
  'admin_tier_promotions_expire_4h',
  '0 */4 * * *',
  $$SELECT public.fn_expire_pending_admin_promotions();$$
);

-- Realtime publication — add admin_tier_promotions so top-tier admins see
-- new pending requests + state transitions live (ratification A-#5).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='admin_tier_promotions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_tier_promotions;
  END IF;
END$$;
