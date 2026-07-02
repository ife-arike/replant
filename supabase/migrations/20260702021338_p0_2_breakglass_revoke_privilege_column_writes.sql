-- P0-2 BREAK-GLASS (pre-UAT audit 2026-07-01): authenticated/anon held UPDATE on privilege/safety
-- columns of public.users + public.churches, and the _update_own RLS is row-scoped (no column CHECK).
-- Worst path: a leader PATCHes users.is_top_tier_admin=true -> custom_access_token_hook mints
-- admin_tier='top_tier' from the column on next refresh -> full Manager. (Proven live 2026-07-01.)
--
-- Applied to prod via Supabase MCP apply_migration; this file mirrors it into the repo
-- (remote version 20260702021338). Reference: docs/audits/2026-07-01-P0-2-privilege-escalation-runbook.md
--
-- ⚠️ Pre-flight (pg_class.relacl vs pg_attribute.attacl) showed the two tables differ:
--   public.users    — UPDATE held at the TABLE level. A column-level REVOKE would be a SILENT no-op,
--                     so we REVOKE the whole-table UPDATE, then re-GRANT only the non-privilege columns.
--                     The re-granted set is exactly today's writable columns minus the 14 privilege/
--                     safety columns, so no current Settings/profile write regresses.
--   public.churches — UPDATE held at the COLUMN level, so a surgical column REVOKE works.
--                     rag_status is intentionally left writable (RAG-Red-for-underground trigger,
--                     durable batch). The broader churches-column allowlist is deferred to the panel.
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (
  id, full_name, anonymous, declaration_affirmed, declaration_date, created_at,
  display_name_preference, preferred_radius, church_card_flow_seen, phone,
  first_name, middle_name, last_name, last_name_first, honorific, suffix,
  include_middle_name, soft_delete_reason, outcome_modal_acknowledged_at, last_seen_at
) ON public.users TO authenticated;

REVOKE UPDATE (
  verification_status, verified, verified_at, show_church_name, type,
  church_code, region_admin_only, is_active, is_headquarters, branch_of_church_id,
  verification_deadline, deactivated_at, soft_deleted_at, hard_delete_scheduled_at,
  hard_deleted_at, rejected_at, underground_join_code_hash
) ON public.churches FROM authenticated, anon;
