-- KAN (emergency plan) — add two nullable boolean columns to public.churches
-- for emergency preparedness capture during church registration.
-- Both nullable: leaders are not required to answer at registration time.
-- has_emergency_plan:    Does the church have an emergency action plan?
-- open_to_collaboration: Is the church open to strategizing with nearby churches?

ALTER TABLE public.churches
  ADD COLUMN has_emergency_plan boolean,
  ADD COLUMN open_to_collaboration boolean;

COMMENT ON COLUMN public.churches.has_emergency_plan IS
  'Leader self-report: whether the church has an emergency action plan in place. NULL = not answered.';
COMMENT ON COLUMN public.churches.open_to_collaboration IS
  'Leader self-report: whether the church is open to strategizing with nearby churches on emergency preparedness. NULL = not answered.';
