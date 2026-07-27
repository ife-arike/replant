-- P1 (pre-UAT audit 2026-07-01): RAG-Red-for-underground was enforced only in create-account; the
-- mobile Settings toggle writes churches.rag_status directly (SettingsScreen.tsx:711), so an
-- underground leader could flip their church off Red post-signup — a locked-invariant bypass.
-- Underground churches are ALWAYS Red and carry NO RAG override. Non-underground rows short-circuit.
-- Applied to prod via Supabase MCP apply_migration (remote version 20260702023938).
CREATE OR REPLACE FUNCTION public.enforce_underground_rag_red()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM 'underground'::public.church_type THEN
    RETURN NEW;  -- non-underground rows unaffected
  END IF;
  NEW.rag_status := 'red'::public.rag_status_enum;
  NEW.rag_status_before_override := NULL;
  NEW.rag_override_expires_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_underground_rag_red ON public.churches;
CREATE TRIGGER trg_enforce_underground_rag_red
  BEFORE INSERT OR UPDATE ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_underground_rag_red();
