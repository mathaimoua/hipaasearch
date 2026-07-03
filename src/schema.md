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