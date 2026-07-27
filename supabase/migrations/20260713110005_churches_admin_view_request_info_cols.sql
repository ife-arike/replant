-- Flow-gaps gap-3 (2026-07-13) — expose the request-info state columns on
-- the canonical admin read path (Watched Invariant #27: churches_admin is
-- the admin queue's view; Invariant #8: it structurally excludes
-- underground). The Verification Queue needs last_outcome_modal_kind to
-- render the "Info requested" row state.
--
-- Column list below reproduces the LIVE view verbatim (pg_get_viewdef,
-- 2026-07-13) with the two modal-state columns APPENDED (append-only —
-- CREATE OR REPLACE VIEW forbids reordering/removing). No reloptions on
-- the live view; grants (authenticated/service_role) are preserved by
-- CREATE OR REPLACE.

CREATE OR REPLACE VIEW public.churches_admin AS
 SELECT id,
    name,
    type,
    city,
    country,
    lat,
    lng,
    state_declaration,
    rag_status,
    needs,
    contact_email,
    contact_phone,
    verified,
    verification_deadline,
    verification_status,
    is_active,
    deactivated_at,
    created_at,
    contact_role,
    admin_notes,
    region_admin_only,
    church_code,
    rag_status_before_override,
    rag_override_expires_at,
    last_outcome_modal_kind,
    last_outcome_modal_shown_at
   FROM churches
  WHERE type <> 'underground'::church_type;
