-- KAN-292 follow-up (2026-06-30 evening smoke)
-- Adds `category` column to escalated_case_proposals so the "Escalate to
-- Manager" proposal action carries a structured reason category — mirrors
-- the 5-value enum already used by escalate-flag.js and
-- triage-pastoral-action.js for the original queue → escalated flow.
--
-- NULL allowed on all non-escalate proposals; required only when
-- action='escalate_to_manager' (compound CHECK below).
--
-- Backfill runs BEFORE the compound CHECK so existing escalate-tier
-- proposals seeded during smoke ratify to 'unsure' — the neutral default.

ALTER TABLE public.escalated_case_proposals
  ADD COLUMN category text NULL;

ALTER TABLE public.escalated_case_proposals
  ADD CONSTRAINT ecp_category_enum_check
  CHECK (
    category IS NULL
    OR category IN (
      'destructive_needed',
      'pattern_multi_flag',
      'pastoral_judgment',
      'cross_tier',
      'unsure'
    )
  );

-- Backfill existing escalate_to_manager rows to the neutral default so
-- the compound CHECK below can be added without ORCA violation.
UPDATE public.escalated_case_proposals
  SET category = 'unsure'
  WHERE action = 'escalate_to_manager'
    AND category IS NULL;

ALTER TABLE public.escalated_case_proposals
  ADD CONSTRAINT ecp_category_required_for_escalate_check
  CHECK (
    action <> 'escalate_to_manager'
    OR category IS NOT NULL
  );
