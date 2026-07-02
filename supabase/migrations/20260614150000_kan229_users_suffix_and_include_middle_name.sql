-- KAN-229 — Settings name-fields fix (design_handoff_settings_name_fields,
-- 2026-06-14). Adds the two new columns the redesigned Settings → 01 Account
-- fields need:
--   - suffix              text NULL              — e.g. "PhD", "MDiv", "ThD",
--                                                  "Hon." (free-form via the
--                                                  Suffix picker's "Other…"
--                                                  branch).
--   - include_middle_name boolean NOT NULL DEFAULT false  — only affects the
--                                                  "Full name + role" preview
--                                                  when middle_name is
--                                                  non-empty.
--
-- Both extend the existing display-name-preference write path. The Settings
-- screen writes via supabase-js `from('users').update({ ... }).eq('auth_id',
-- userId)` exactly like the existing last_name_first / honorific writes —
-- no RPC changes needed at this layer.
--
-- Applied to remote via MCP apply_migration on 2026-06-14; this file mirrors
-- the change into source control so the migration history stays canonical.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suffix text NULL,
  ADD COLUMN IF NOT EXISTS include_middle_name boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.suffix IS
  'Display suffix (e.g., PhD, MDiv) shown after the leader''s name when set. '
  'Free-form via the Settings picker''s "Other" branch; max 12 chars enforced '
  'at the API boundary.';

COMMENT ON COLUMN public.users.include_middle_name IS
  'When true and middle_name is non-empty, the "Full name + role" preview '
  'includes the middle name. Set via Settings → 01 Account → Format checkbox. '
  'Has no effect on the "First/Last name + role" preview.';
