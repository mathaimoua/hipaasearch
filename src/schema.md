-- HIPAA regulation sections table
create table hipaa_sections (
  id uuid primary key default gen_random_uuid(),
  citation text not null,        -- e.g. "45 CFR 164.502"
  part text not null,            -- "164"
  subpart text,                  -- "E" (Privacy), "C" (Security), etc.
  section_number text,           -- "164.502"
  heading text,                  -- short section title
  body text not null,            -- full section text
  source_url text,               -- link back to eCFR for this section
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(body, ''))
  ) stored,
  created_at timestamptz default now()
);

-- Index for fast full-text search
create index hipaa_sections_search_idx on hipaa_sections using gin(search_vector);

-- Enable Row Level Security
alter table hipaa_sections enable row level security;

-- Allow anyone to read (it's public regulatory text, no auth needed for search)
create policy "Public read access"
  on hipaa_sections for select
  using (true);

-- No public insert/update/delete policies — only the service_role key (used by
-- your Python ingestion script) can write, since it bypasses RLS entirely.

alter table hipaa_sections
  add constraint hipaa_sections_section_number_key unique (section_number);

-- HIPAA definitions table — individual defined terms from 45 CFR 160.103
-- Separate from hipaa_sections because this is term -> definition lookups,
-- not full regulatory section text.
create table hipaa_definitions (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  definition text not null,
  citation text not null,          -- "45 CFR 160.103"
  source_url text,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(term, '') || ' ' || coalesce(definition, ''))
  ) stored,
  created_at timestamptz default now()
);

create index hipaa_definitions_search_idx on hipaa_definitions using gin(search_vector);
alter table hipaa_definitions add constraint hipaa_definitions_term_key unique (term);

alter table hipaa_definitions enable row level security;

create policy "Public read access"
  on hipaa_definitions for select
  using (true);

-- No insert/update/delete policy for the public — only the service_role key
-- (used by the ingestion script) can write.

-- Custom username/password login — deliberately NOT using Supabase Auth
-- (no email involved at all). Login is not self-service: accounts are
-- created by running `select create_user('someusername', 'somepassword');`
-- yourself in the Supabase SQL editor, and every account gets admin
-- privileges by default.
--
-- pgcrypto gives us crypt() / gen_salt('bf'), which does proper bcrypt
-- password hashing — the password itself is never stored, only the hash.
-- Supabase installs extensions like this into an "extensions" schema
-- rather than "public" by default — that's why the two functions below
-- explicitly include both "public" and "extensions" in their search_path,
-- so they can find crypt()/gen_salt() no matter which schema it landed in.
create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz default now()
);

create unique index users_username_key on users (lower(username));

alter table users enable row level security;

-- No select/insert/update/delete policies for anyone — this table is
-- completely locked from direct client access. The only way in or out is
-- through the two SECURITY DEFINER functions below, which never return
-- password_hash to the caller.

-- Run this yourself in the SQL editor to create an account, e.g.:
--   select create_user('matt', 'a-strong-password-here');
-- SECURITY DEFINER lets it write to `users` even though RLS above blocks
-- normal access; it's safe here because it's not exposed to the app (no
-- grant to anon/authenticated), so only someone with SQL editor / service
-- role access can call it.
create or replace function public.create_user(p_username text, p_password text, p_role text default 'admin')
returns uuid as $$
declare
  new_id uuid;
begin
  insert into public.users (username, password_hash, role)
  values (p_username, crypt(p_password, gen_salt('bf')), p_role)
  returning id into new_id;
  return new_id;
end;
$$ language plpgsql security definer set search_path = public, extensions;

-- The one function the app itself calls (via the publishable key) to check
-- a login attempt. Compares the given password against the stored hash
-- server-side with crypt(), and only ever returns non-secret columns. If
-- the username doesn't exist or the password is wrong, it returns no rows
-- either way, so a wrong guess can't be used to figure out which usernames
-- are real.
create or replace function public.verify_login(p_username text, p_password text)
returns table (id uuid, username text, role text) as $$
begin
  return query
    select u.id, u.username, u.role
    from public.users u
    where lower(u.username) = lower(p_username)
      and u.password_hash = crypt(p_password, u.password_hash);
end;
$$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.verify_login(text, text) to anon, authenticated;

-- Shared by both search_sections and get_section below: turns whatever was
-- typed into a Postgres full-text search query, so this "how do we turn
-- typed words into a database search" logic only has to live in one
-- place instead of being copy-pasted into every function that needs it.
create or replace function public.build_prefix_tsquery(p_query text)
returns text as $$
declare
  words text[];
  cleaned text[];
  w text;
begin
  -- Break what was typed into separate words, throwing out anything that
  -- isn't a letter, number, or apostrophe so it can't be used to break out
  -- of the search syntax below.
  words := regexp_split_to_array(trim(coalesce(p_query, '')), '\s+');
  cleaned := '{}';
  foreach w in array words loop
    w := regexp_replace(w, '[^a-zA-Z0-9'']', '', 'g');
    if length(w) > 0 then
      cleaned := array_append(cleaned, w);
    end if;
  end loop;

  -- Nothing usable was typed (blank, or only symbols) — nothing to search
  -- for.
  if array_length(cleaned, 1) is null then
    return null;
  end if;

  -- Turn ['privacy', 'ru'] into 'privacy:* & ru:*' — the ":*" means "starts
  -- with", so results start appearing before the visitor finishes typing
  -- the last word, and "&" means every word has to appear somewhere in the
  -- text for it to count as a match.
  return (select string_agg(word || ':*', ' & ') from unnest(cleaned) as word);
end;
$$ language plpgsql immutable set search_path = public;

grant execute on function public.build_prefix_tsquery(text) to anon, authenticated;

-- Live "search as you type" over hipaa_sections, ranked by best match.
-- The exact-term definition lookup doesn't need a function — the app just
-- does a plain case-insensitive select against hipaa_definitions, since
-- that's a simple exact match with no ranking involved. Regulation section
-- search is different: it needs relevance ranking (which section mentions
-- the term the most/most closely), which the Supabase client library can't
-- express on its own, so it lives here as a database function instead.
--
-- No SECURITY DEFINER here (unlike verify_login/create_user above) — this
-- only reads from hipaa_sections, which already has a public-read RLS
-- policy, so it runs fine with the caller's own normal privileges.
create or replace function public.search_sections(p_query text, p_limit int default 20)
returns table (
  id uuid,
  citation text,
  heading text,
  snippet text,
  source_url text,
  rank real
) as $$
declare
  tsquery_text text;
begin
  tsquery_text := public.build_prefix_tsquery(p_query);

  -- Nothing usable was typed — no results, and no point running a search
  -- query.
  if tsquery_text is null then
    return;
  end if;

  return query
    select
      s.id,
      s.citation,
      s.heading,
      -- A short excerpt from the section text with matching words wrapped
      -- in [[H]]...[[/H]] markers, so the app can highlight them without
      -- having to trust/render raw HTML. MaxFragments=1 keeps it to one
      -- excerpt; MinWords/MaxWords control roughly how long it is.
      ts_headline(
        'english', s.body, to_tsquery('english', tsquery_text),
        'StartSel=[[H]], StopSel=[[/H]], MaxFragments=1, MaxWords=40, MinWords=15'
      ) as snippet,
      s.source_url,
      -- ts_rank_cd ("cover density" ranking) scores a section higher the
      -- more often, and the more closely together, the searched words
      -- appear in it — which is what "best match" means here.
      ts_rank_cd(s.search_vector, to_tsquery('english', tsquery_text)) as rank
    from public.hipaa_sections s
    where s.search_vector @@ to_tsquery('english', tsquery_text)
    order by rank desc
    limit p_limit;
end;
$$ language plpgsql stable set search_path = public;

grant execute on function public.search_sections(text, int) to anon, authenticated;

-- Fetches one section's full text for the detail view (opened by clicking
-- a search result or a sidebar entry). If a search query is passed in,
-- every matching word throughout the *entire* body gets wrapped in
-- [[H]]...[[/H]] markers too — not just a short excerpt like
-- search_sections above — via ts_headline's HighlightAll=true option,
-- which tells it to return the whole document instead of trimming it down
-- to a fragment. That's what keeps the search terms highlighted after
-- opening the full text. If p_query is left blank (e.g. opened straight
-- from the sidebar with nothing searched), the body comes back untouched.
create or replace function public.get_section(p_id uuid, p_query text default null)
returns table (
  id uuid,
  citation text,
  heading text,
  body text,
  source_url text
) as $$
declare
  tsquery_text text;
begin
  tsquery_text := public.build_prefix_tsquery(p_query);

  if tsquery_text is null then
    return query
      select s.id, s.citation, s.heading, s.body, s.source_url
      from public.hipaa_sections s
      where s.id = p_id;
  else
    return query
      select
        s.id,
        s.citation,
        s.heading,
        ts_headline(
          'english', s.body, to_tsquery('english', tsquery_text),
          'StartSel=[[H]], StopSel=[[/H]], HighlightAll=true'
        ) as body,
        s.source_url
      from public.hipaa_sections s
      where s.id = p_id;
  end if;
end;
$$ language plpgsql stable set search_path = public;

grant execute on function public.get_section(uuid, text) to anon, authenticated;

-- Lets the homepage show visitors "Data last updated <date>", so they can
-- tell the regulation text isn't stale. updated_at gets stamped with the
-- current time automatically, by the database itself, whenever a row in
-- either table is inserted or updated — so it always reflects the last
-- time the ingestion scripts (ingest_hipaa.py / ingest_definitions.py)
-- actually ran, with no changes needed to those scripts.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table hipaa_sections add column updated_at timestamptz not null default now();
create trigger set_hipaa_sections_updated_at
  before insert or update on hipaa_sections
  for each row execute procedure public.set_updated_at();

alter table hipaa_definitions add column updated_at timestamptz not null default now();
create trigger set_hipaa_definitions_updated_at
  before insert or update on hipaa_definitions
  for each row execute procedure public.set_updated_at();

-- Powers the in-app "System Health" page. True uptime can't be reported by
-- the database itself (it can't tell you it's down while it's down — see
-- the README's Monitoring section for where that actually lives, in
-- Supabase's own dashboard). What Postgres CAN report on is its own
-- performance, automatically, the same way a car's odometer tracks
-- mileage without anyone typing numbers in — that's what these two
-- functions read.
--
-- pg_stat_statements is what powers Supabase's own "Query Performance"
-- dashboard report too. On Supabase this can be turned on right here with
-- `create extension`; if that ever fails because of permissions, it can
-- also be enabled from the dashboard under Database -> Extensions.
create extension if not exists pg_stat_statements;

-- SECURITY DEFINER here (like verify_login/create_user earlier) because
-- the pg_stat_* system views aren't readable by the anon/authenticated
-- roles by default — only by the function's owner, which on Supabase is
-- whichever role ran this SQL (with full read access to its own stats).
--
-- Deliberately does NOT report anything about the `users` table (e.g. how
-- many accounts exist). Like every other function in this file, this one
-- ends up reachable by anyone with the public/publishable key (see the
-- note on search_sections above) since this app has no real per-request
-- login session for Postgres to check — so the numbers here are limited to
-- generic database stats and the public content tables only.
create or replace function public.get_system_health()
returns table (
  database_size_bytes bigint,
  active_connections int,
  cache_hit_ratio double precision,
  hipaa_sections_count bigint,
  hipaa_definitions_count bigint
) as $$
begin
  return query
    select
      pg_database_size(current_database()) as database_size_bytes,
      (
        select count(*)::int
        from pg_stat_activity
        where datname = current_database()
      ) as active_connections,
      (
        -- What fraction of reads were served from memory instead of disk —
        -- closer to 1 (100%) is better. Falls back to 1 instead of
        -- dividing by zero on a freshly created database with no read
        -- activity yet.
        select case
          when sum(blks_hit) + sum(blks_read) = 0 then 1.0::double precision
          else sum(blks_hit)::double precision / (sum(blks_hit) + sum(blks_read))::double precision
        end
        from pg_stat_database
        where datname = current_database()
      ) as cache_hit_ratio,
      (select count(*) from public.hipaa_sections) as hipaa_sections_count,
      (select count(*) from public.hipaa_definitions) as hipaa_definitions_count;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.get_system_health() to anon, authenticated;

-- The slowest queries this app has run, worst first, from
-- pg_stat_statements. Truncated to 200 characters mainly to keep the
-- result readable — this app only ever runs a handful of known,
-- parameterized queries (the functions in this file), so there's little
-- risk of the query text itself leaking anything sensitive.
--
-- Same "extensions" schema gotcha as pgcrypto earlier in this file:
-- Supabase installs extensions like pg_stat_statements into a schema
-- called "extensions", not "public", so search_path has to include both
-- or this function can't find it.
-- p_min_ms filters out anything faster than that, on average, per call
-- (mean_exec_time) — mainly to hide the constant stream of sub-millisecond
-- PostgREST bookkeeping queries (session setup, transaction BEGIN/COMMIT)
-- that run on every single API request, so this only shows queries
-- actually worth looking at.
--
-- This adds a new parameter (p_min_ms) to what used to be a one-parameter
-- function, which Postgres treats as a distinct overload rather than a
-- replacement — drop the old one first so the app doesn't end up with two
-- ambiguous versions of "get_slow_queries" to choose between.
drop function if exists public.get_slow_queries(int);

create or replace function public.get_slow_queries(p_limit int default 5, p_min_ms double precision default 10)
returns table (
  query text,
  calls bigint,
  mean_exec_time double precision,
  total_exec_time double precision
) as $$
begin
  return query
    select
      left(s.query, 200) as query,
      s.calls,
      s.mean_exec_time,
      s.total_exec_time
    from pg_stat_statements s
    where s.dbid = (select oid from pg_database where datname = current_database())
      and s.mean_exec_time > p_min_ms
    order by s.total_exec_time desc
    limit p_limit;
end;
$$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.get_slow_queries(int, double precision) to anon, authenticated;