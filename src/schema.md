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