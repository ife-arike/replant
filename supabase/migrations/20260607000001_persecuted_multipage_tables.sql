-- Persecuted Tab Multi-Page Expansion — new tables + RPCs
-- witnesses, articles, guidance tables + RPCs for the multi-page experience.
--
-- DRAFT: Witness data and article data need Founder + Editorial sign-off
-- before any public release. Run in plan-mode with founder.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. witnesses table
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.witnesses (
  id              uuid primary key default gen_random_uuid(),
  era             text not null,
  years_label     text not null,
  name            text not null,
  region          text,
  category        text not null check (category in (
                    'Martyr',
                    'Father of the Faith',
                    'Mother of the Faith',
                    'God''s General',
                    'From Scripture'
                  )),
  martyr          boolean not null default false,
  quote           text not null,
  scripture_ref   text not null,
  scripture_text  text,
  description     text,
  source_attribution text,
  published_at    timestamptz default now(),
  rotation_day    int
);

comment on table public.witnesses is 'Cloud of witnesses — daily-rotating featured cards on Bear Witness surface. DRAFT until Founder + Editorial finalize.';

-- RLS: read-only for authenticated users
alter table public.witnesses enable row level security;

create policy "witnesses_read_authenticated"
  on public.witnesses for select
  to authenticated
  using (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. articles table
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.articles (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  author          text not null,
  title           text not null,
  body_md         text not null,
  pull_quote      text,
  scripture_ref   text,
  scripture_text  text,
  published_at    timestamptz default now()
);

comment on table public.articles is 'In-app editorial articles for Bear Witness surface. NEVER opens external URL.';

alter table public.articles enable row level security;

create policy "articles_read_authenticated"
  on public.articles for select
  to authenticated
  using (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. guidance table
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.guidance (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  eyebrow         text not null,
  title           text not null,
  subtitle        text,
  steps           jsonb not null,
  scripture_ref   text,
  scripture_text  text,
  published_at    timestamptz default now()
);

comment on table public.guidance is 'Practical guidance for Take Heart surface. NEVER opens external URL. No telemetry. selectable={false}.';

alter table public.guidance enable row level security;

create policy "guidance_read_authenticated"
  on public.guidance for select
  to authenticated
  using (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RPCs — all SECURITY DEFINER, anonymized returns only
-- ═══════════════════════════════════════════════════════════════════════

-- get_my_heartcries: own submissions with status
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

-- get_standing_this_week: aggregate stats (anonymous)
create or replace function public.get_standing_this_week()
returns table (
  leaders_praying bigint,
  heartcries_held bigint,
  active_regions bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(distinct hh.user_id) from heartcry_holds hh
     where hh.created_at > now() - interval '7 days') as leaders_praying,
    (select count(*) from heartcries
     where created_at > now() - interval '30 days'
       and feed_approved = true) as heartcries_held,
    (select count(distinct region) from heartcries
     where created_at > now() - interval '7 days'
       and feed_approved = true
       and region is not null) as active_regions;
$$;

-- get_story_archive: filter by source
create or replace function public.get_story_archive(p_filter text default 'all')
returns table (
  id uuid,
  source text,
  author text,
  title text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.source, a.author, a.title, a.published_at
  from articles a
  where case
    when p_filter = 'replant' then a.source = 'Replant Editorial'
    when p_filter = 'partner' then a.source != 'Replant Editorial'
    else true
  end
  order by a.published_at desc;
$$;

-- get_article: single article by ID
create or replace function public.get_article(p_article_id uuid)
returns table (
  id uuid,
  source text,
  author text,
  title text,
  body_md text,
  pull_quote text,
  scripture_ref text,
  scripture_text text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.source, a.author, a.title, a.body_md,
         a.pull_quote, a.scripture_ref, a.scripture_text, a.published_at
  from articles a
  where a.id = p_article_id;
$$;

-- get_guidance: single guidance by slug
create or replace function public.get_guidance(p_slug text)
returns table (
  id uuid,
  slug text,
  eyebrow text,
  title text,
  subtitle text,
  steps jsonb,
  scripture_ref text,
  scripture_text text
)
language sql
security definer
set search_path = public
as $$
  select g.id, g.slug, g.eyebrow, g.title, g.subtitle,
         g.steps, g.scripture_ref, g.scripture_text
  from guidance g
  where g.slug = p_slug;
$$;

-- get_witness_of_day: daily rotation based on day-of-year
create or replace function public.get_witness_of_day()
returns table (
  id uuid,
  era text,
  years_label text,
  name text,
  region text,
  category text,
  martyr boolean,
  quote text,
  scripture_ref text,
  scripture_text text,
  description text,
  source_attribution text
)
language sql
security definer
set search_path = public
as $$
  select w.id, w.era, w.years_label, w.name, w.region, w.category,
         w.martyr, w.quote, w.scripture_ref, w.scripture_text,
         w.description, w.source_attribution
  from witnesses w
  order by (
    (extract(doy from now())::int + extract(year from now())::int) % greatest((select count(*) from witnesses), 1)
    - coalesce(w.rotation_day, 0)
  )
  limit 1;
$$;

-- get_witnesses: archive with filter
create or replace function public.get_witnesses(p_filter text default 'all')
returns table (
  id uuid,
  era text,
  years_label text,
  name text,
  region text,
  category text,
  martyr boolean,
  quote text,
  scripture_ref text,
  description text
)
language sql
security definer
set search_path = public
as $$
  select w.id, w.era, w.years_label, w.name, w.region, w.category,
         w.martyr, w.quote, w.scripture_ref, w.description
  from witnesses w
  where case
    when p_filter = 'martyr' then w.martyr = true
    when p_filter = 'father' then w.category = 'Father of the Faith'
    when p_filter = 'mother' then w.category = 'Mother of the Faith'
    when p_filter = 'general' then w.category = 'God''s General'
    when p_filter = 'scripture' then w.category = 'From Scripture'
    else true
  end
  order by w.era asc;
$$;

-- get_active_intercession_count: live count for "body with you" block
create or replace function public.get_active_intercession_count()
returns table (count bigint)
language sql
security definer
set search_path = public
as $$
  select count(distinct hh.user_id)
  from heartcry_holds hh
  where hh.created_at > now() - interval '24 hours';
$$;
