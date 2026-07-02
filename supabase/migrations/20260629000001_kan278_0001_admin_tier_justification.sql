-- KAN-278 — Sponsor justification on admin tier promotions.
--
-- ApprovePromotionModal.jsx:59 read promotion.justification but the
-- column did not exist on admin_tier_promotions — every approval modal
-- rendered "Their justification: —" because the value was always
-- undefined. Stale UI artifact from a feature that never landed.
--
-- Founder ruling 2026-06-29 (Path A — build the feature):
-- - Add nullable justification column to admin_tier_promotions
-- - 2000-char limit (matches denial_reason posture)
-- - Optional on the sponsor side; approver sees "—" when blank
-- - audit_log captures whether justification was provided (boolean)
--
-- Backward-compat: the new fn_request_admin_promotion signature has
-- p_justification text DEFAULT NULL. The OLD 2-arg signature is dropped;
-- callers that still pass 2 args (e.g., pre-deploy admin BE) resolve to
-- the new 3-arg function with DEFAULT NULL applied. Calling with 3 args
-- (new FE) writes the value. No prod admin call breaks.

-- ── 1. Add column with length CHECK ───────────────────────────────────────
ALTER TABLE public.admin_tier_promotions
  ADD COLUMN IF NOT EXISTS justification text;

ALTER TABLE public.admin_tier_promotions
  DROP CONSTRAINT IF EXISTS admin_tier_promotions_justification_len_chk;

ALTER TABLE public.admin_tier_promotions
  ADD CONSTRAINT admin_tier_promotions_justification_len_chk
  CHECK (justification IS NULL OR char_length(justification) <= 2000);

COMMENT ON COLUMN public.admin_tier_promotions.justification IS
  'KAN-278 — optional sponsor-provided context explaining why this candidate is being sponsored. 2000-char max enforced by check constraint. Surfaces to the approver in ApprovePromotionModal.';

-- ── 2. Replace fn_request_admin_promotion with the 3-arg signature ───────
-- Postgres treats different arg counts as separate functions, so the
-- 2-arg form must be dropped explicitly to avoid ambiguous overload
-- resolution (DEFAULT NULL on the new form means it ALSO matches 2-arg
-- calls; without dropping the old, every call would be ambiguous).
DROP FUNCTION IF EXISTS public.fn_request_admin_promotion(uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.fn_request_admin_promotion(
  p_candidate_user_id     uuid,
  p_sponsor_aal2_fresh_at timestamptz,
  p_justification         text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id              uuid;
  v_candidate_tier         text;
  v_promotion_id           uuid;
  v_normalized_justification text;
BEGIN
  v_caller_id := public.fn_assert_super_admin();
  IF p_candidate_user_id IS NULL THEN RAISE EXCEPTION 'missing_field:candidate_user_id' USING ERRCODE='22023'; END IF;
  IF p_sponsor_aal2_fresh_at IS NULL THEN RAISE EXCEPTION 'missing_field:sponsor_aal2_fresh_at' USING ERRCODE='22023'; END IF;
  IF p_candidate_user_id = v_caller_id THEN RAISE EXCEPTION 'no_self_sponsor' USING ERRCODE='42501'; END IF;

  -- Normalize: trim whitespace, treat empty string as NULL so the
  -- "blank textarea" path stores NULL rather than an empty string.
  v_normalized_justification := NULLIF(TRIM(COALESCE(p_justification, '')), '');
  IF v_normalized_justification IS NOT NULL AND char_length(v_normalized_justification) > 2000 THEN
    RAISE EXCEPTION 'justification_too_long' USING ERRCODE='22023';
  END IF;

  -- Candidate must currently be a Regular admin (app_metadata.admin_tier='regular',
  -- not already super_admin or top_tier).
  SELECT au.raw_app_meta_data ->> 'admin_tier' INTO v_candidate_tier
    FROM public.users u JOIN auth.users au ON au.id = u.auth_id
    WHERE u.id = p_candidate_user_id
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_candidate_tier IS DISTINCT FROM 'regular' THEN
    RAISE EXCEPTION 'candidate_not_regular_admin' USING ERRCODE='22023';
  END IF;

  -- No existing pending request for this candidate.
  IF EXISTS (SELECT 1 FROM public.admin_tier_promotions
             WHERE candidate_user_id = p_candidate_user_id AND state = 'pending') THEN
    RAISE EXCEPTION 'promotion_already_pending' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.admin_tier_promotions
    (candidate_user_id, sponsor_user_id, sponsor_aal2_fresh_at, justification)
    VALUES (p_candidate_user_id, v_caller_id, p_sponsor_aal2_fresh_at, v_normalized_justification)
    RETURNING id INTO v_promotion_id;

  -- Audit: capture justification_provided as a boolean. The text itself
  -- stays in admin_tier_promotions; the audit log carries presence only
  -- (justification can be PII-adjacent — operator context — and the
  -- promotion row is the canonical record).
  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_tier_promotion_requested', v_caller_id, 'user'::text,
            jsonb_build_object(
              'promotion_id', v_promotion_id,
              'candidate_user_id', p_candidate_user_id,
              'justification_provided', v_normalized_justification IS NOT NULL
            ));

  RETURN v_promotion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_request_admin_promotion(uuid, timestamptz, text) TO authenticated;

-- ── 3. PostgREST schema cache reload ─────────────────────────────────────
-- New function signature; trigger PostgREST to refresh its function cache
-- so the new (uuid, timestamptz, text) signature is callable immediately.
NOTIFY pgrst, 'reload schema';
