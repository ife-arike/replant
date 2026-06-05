-- Extracted from 20260607000001 for early deployment. Remainder (witnesses/articles/guidance) waits for data seeding session.
--
-- Remote-schema reconciliation (verified 2026-06-07 against jiyetphxxvyiicrnwlnx):
--   * heartcries.submitted_by does NOT exist on remote. The real submitter column is
--     heartcries.user_id (uuid, FK -> public.users.id). The JOIN below uses user_id to
--     avoid creating a duplicate users<->heartcries FK (PostgREST disambiguation footgun).
--   * heartcries.thread_id is genuinely missing -> added below (nullable uuid).
--   * heartcries.status is enum heartcry_status (received|seen|responded) -> ::text cast.
--   * heartcries.severity is a USER-DEFINED enum -> ::text cast.
--   * public.users.id <> auth.uid() in Replant -> filter via users.auth_id = auth.uid().

-- Missing column: thread_id (return-shape dependency for the My Heartcries tab)
alter table public.heartcries
  add column if not exists thread_id uuid;

-- get_my_heartcries: a leader's own submissions with status, newest first
create or replace function public.get_my_heartcries()
returns table (
  id uuid,
  severity text,
  created_at timestamptz,
  feed_content text,
  status text,
  responded_at timestamptz,
  thread_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    h.id,
    h.severity::text,
    h.created_at,
    h.feed_content,
    h.status::text,
    h.responded_at,
    h.thread_id
  from heartcries h
  join users u on u.id = h.user_id
  where u.auth_id = auth.uid()
  order by h.created_at desc;
$$;
