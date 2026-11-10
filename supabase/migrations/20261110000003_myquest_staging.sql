-- Staging for the MyQuest importer. Raw pages and papers are recorded before any question is
-- interpreted, so a paper can be checked, resumed and re-run without fetching again.
-- Admin only. Students never see any of this.

create type public.import_paper_status as enum ('fetching', 'incomplete', 'complete', 'staged', 'published');

-- One paper = exam + year + subject, exactly as the provider catalogue names them.
create table public.import_papers (
  id uuid primary key default gen_random_uuid(),
  -- mq:EXAM:YEAR:SUBJECT. Provider question ids restart per paper, so this scopes them.
  paper_key text not null unique,
  provider_exam text not null,
  provider_year text not null,
  provider_subject text not null,
  -- Reviewed mapping to our subject, set by hand once.
  subject_id text references public.subjects (id),
  year int check (year between 1978 and 2100),
  reported_total int,
  reported_pages int,
  fetched_total int not null default 0,
  status public.import_paper_status not null default 'fetching',
  -- Reconcile issue codes from the last fetch. Empty and status complete means it adds up.
  issues jsonb not null default '[]',
  adapter_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per page fetched. The page is stored before the next request goes out.
create table public.import_pages (
  paper_id uuid not null references public.import_papers (id) on delete cascade,
  page int not null check (page >= 1),
  attempts int not null default 1,
  body_hash text not null,
  received int not null,
  -- The provider response exactly as received. Restricted: it holds answer keys.
  raw jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (paper_id, page)
);

-- Rows gain the paper they came from, so rows from different papers can never be confused.
alter table public.question_import_rows
  add column paper_id uuid references public.import_papers (id) on delete cascade,
  add column page int,
  add column payload_hash text,
  add column reasons text[] not null default '{}';
create unique index question_import_rows_paper_source_idx
  on public.question_import_rows (paper_id, source_ref) where paper_id is not null;

create trigger import_papers_touch before update on public.import_papers
  for each row execute function private.touch_updated_at();

alter table public.import_papers enable row level security;
alter table public.import_pages enable row level security;
revoke all on public.import_papers, public.import_pages from anon, authenticated;
grant select, insert, update, delete on public.import_papers, public.import_pages to authenticated;
create policy import_papers_admin on public.import_papers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy import_pages_admin on public.import_pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
