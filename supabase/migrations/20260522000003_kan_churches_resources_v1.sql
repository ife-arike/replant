-- Add resources column to capture what a church has to offer,
-- paired with the existing needs column.
-- Text array, nullable — populated at registration and editable via Church Profile.

ALTER TABLE public.churches
  ADD COLUMN resources text[];

COMMENT ON COLUMN public.churches.resources IS
  'What the church has to offer (skills, manpower, space, etc). Complement to needs[].';
