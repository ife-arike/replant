-- KAN-338 / kan338_0005 — column lockdowns (queue step: REVOKEs)
--
-- Panel-scoped minimum, executed after a two-repo client-select sweep
-- (mobile + admin) so no granted surface breaks:
--
--   1. churches: table-level SELECT dropped for authenticated + anon and
--      re-granted as an explicit column list = every live column MINUS
--      region_admin_only, lat, lng (the P0-2 lesson: a column REVOKE against
--      a table grant is a silent no-op, so drop-and-regrant is the only real
--      path). city STAYS granted (user embeds read it; the SEC pin's
--      city-exclusion is amended — surface-church cities are product-visible
--      app-wide and UG rows force city/lat/lng NULL by CHECK). anon retains
--      NO direct churches read (all pre-auth flows are DEFINER RPCs).
--      Column-scoped UPDATE (rag_status only, P0-2 batch) untouched.
--   2. comments: direct SELECT revoked for authenticated + anon — the
--      get_comments RPC is the only intended read path; per-comment
--      author_id harvesting over PostgREST is closed.
--
-- DEFERRED, with reasons (KAN-338 record):
--   - announcements.author_id revoke: the admin dashboard's announcements
--     wall embeds author via author_id (SELECT_COLS `author:author_id(...)`)
--     under the same authenticated role — revoking breaks the surface. The
--     leader-correlation exposure is already CLOSED at the data layer
--     (kan338_0003: all submission publications carry the system Team user).
--     Revoke lands when the admin list moves to a service-role endpoint.
--   - churches column diet: the re-grant intentionally preserves today's
--     column surface, which includes admin-register fields (admin_notes,
--     rejection/appeal metadata) readable on ACTIVE rows by any verified
--     leader via churches_select_active. Filed as its own finding (KAN-340);
--     needs a per-column product pass, not a rushed judgment here.
--
-- APPLIED LIVE 2026-07-25 via execute_sql; verified via has_column_privilege
-- (region/lat/lng denied; name/city/verification_status/contact granted;
-- rag_status UPDATE intact) + REST probes (churches/comments 42501 for anon;
-- announcements unchanged). Not in supabase_migrations by batch convention.

BEGIN;

REVOKE SELECT ON public.churches FROM authenticated, anon;
GRANT SELECT (
  id,name,type,city,country,state_declaration,rag_status,needs,contact_email,
  contact_phone,contact_scrubbed_at,verified,verification_deadline,
  verification_status,is_active,deactivated_at,created_at,
  rag_override_expires_at,rag_status_before_override,rejected_at,contact_role,
  admin_notes,church_code,address,contact_name,has_emergency_plan,
  open_to_collaboration,resources,website_url,primary_language,
  denomination_affiliation,congregation_size_range,show_contact_on_profile,
  verified_at,profile_completion_done,profile_completion_done_by,
  show_church_name,branch_of_church_id,is_headquarters,
  underground_join_code_hash,underground_join_code_issued_at,
  underground_join_code_revealed_at,underground_join_code_rotated_at,
  soft_deleted_at,soft_delete_reason,hard_delete_scheduled_at,hard_deleted_at,
  last_outcome_modal_shown_at,last_outcome_modal_kind,rejection_reason_code,
  rejection_reason_meta,appeal_status,appeal_received_at,
  appeal_email_thread_id,in_review_claimed_by,in_review_claimed_at,
  in_review_routed_to_founder_at,rejected_by
) ON public.churches TO authenticated;

REVOKE SELECT ON public.comments FROM authenticated, anon;

COMMIT;
