-- KAN-338 / kan338_0001 — underground name-axis hardening (P0-B)
--
-- Founder GO 2026-07-25 (all four panel asks granted), settling the
-- 2026-06-05 vs 2026-06-21 ruling conflict as: underground masks the CHURCH
-- by default (decoupling semantics stand), AND the leader-name axis gets a
-- forced-safe default. users.anonymous was defaulting false at signup,
-- client-PATCHable, with no underground term on the comments name axis —
-- an underground leader who never found the toggle was named to every
-- authenticated caller. The church axis (show_church_name) already has
-- ceremony-guarded protection; this gives its name twin the same posture.
--
-- Three parts:
--   1. Backfill: every current underground member becomes anonymous unless
--      a ceremony ever says otherwise. VISIBLE display change, Founder-GO'd.
--   2. Trigger guard: a DIRECT client write may never un-anonymise an
--      underground member. SECURITY INVOKER so current_user is the real
--      caller ('authenticated'/'anon' via PostgREST; 'postgres' inside
--      DEFINER fns; 'service_role' for admin paths). Surface leaders are
--      untouched and toggle freely.
--   3. Intake trigger: anonymity forced true at INSERT when the church is
--      underground — covers every signup path (create-account belt rides in
--      the edge function; this is the braces).
--
-- Release valve = two-admin ceremony (underground_verification_proposals
-- action 'leader_name_override') — spec'd in the KAN-338 synthesis, built
-- under its own ticket. Until it ships, a UG leader who wants to be named
-- has no path (Founder aware, accepted).
--
-- Monotone Protection Ratchet (panel-locked): disclosure requires permission
-- at authorship AND now; tightening is automatic and retroactive; loosening
-- never un-redacts outside the audited ceremonies.
--
-- UNAPPLIED — files-only. Apply gates: VERIFY-LIVE batch (KAN-338 synthesis
-- §rollout 1) including the UG un-anonymised blast-radius count.

BEGIN;

-- 1. Backfill.
UPDATE public.users u
   SET anonymous = true
  FROM public.churches c
 WHERE c.id = u.church_id
   AND c.type = 'underground'
   AND COALESCE(u.anonymous, false) = false;

-- 2. Direct-write guard.
CREATE OR REPLACE FUNCTION public.guard_users_anonymity_axis()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND COALESCE(OLD.anonymous, false) = true
     AND COALESCE(NEW.anonymous, false) = false
     AND EXISTS (
       SELECT 1 FROM public.churches c
        WHERE c.id = NEW.church_id AND c.type = 'underground'
     )
  THEN
    RAISE EXCEPTION 'underground anonymity may not be released by direct write'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_users_anonymity_axis ON public.users;
CREATE TRIGGER trg_guard_users_anonymity_axis
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_anonymity_axis();

-- 3. Intake forcing.
CREATE OR REPLACE FUNCTION public.tg_users_force_ug_anonymity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF NEW.church_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.churches c
        WHERE c.id = NEW.church_id AND c.type = 'underground')
  THEN
    NEW.anonymous := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_force_ug_anonymity ON public.users;
CREATE TRIGGER trg_users_force_ug_anonymity
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_users_force_ug_anonymity();

COMMENT ON COLUMN public.users.anonymous IS
  'THE leader-name axis. Underground members are forced true at intake and may not be '
  'un-anonymised by a direct client write (trg_guard_users_anonymity_axis); release is a '
  'two-admin ceremony only, mirroring churches.show_church_name. Surface leaders toggle freely.';

COMMIT;
