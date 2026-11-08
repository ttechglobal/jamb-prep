-- JAMB Prep core schema. Independent of Exam Prep A1.
-- Questions arrive through question_import_rows, never directly from the source system.

create schema if not exists private;

create type public.user_role as enum ('student', 'admin');
create type public.question_status as enum ('draft', 'published', 'retired');
create type public.practice_mode as enum ('quick_five', 'subject', 'timed', 'mock');
create type public.session_status as enum ('in_progress', 'submitted', 'expired');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
create type public.import_row_status as enum ('pending', 'valid', 'rejected', 'duplicate', 'imported');

-- Reference data ------------------------------------------------------------

create table public.subjects (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique,
  short_name text not null,
  is_compulsory boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id),
  slug text not null,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (subject_id, slug)
);

-- Exam rules are data, so a JAMB format change is a row edit, not a deploy.
create table public.exam_formats (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  total_duration_sec int not null check (total_duration_sec > 0),
  compulsory_subject_id text not null references public.subjects (id),
  rules jsonb not null,
  effective_from date not null,
  active boolean not null default false
);
create unique index exam_formats_one_active on public.exam_formats (active) where active;

-- Question bank -------------------------------------------------------------

create function public.is_valid_question_options(p_options jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_options) = 'array'
    and jsonb_array_length(p_options) = 4
    and (
      select array_agg(o ->> 'key' order by o ->> 'key') = array['A', 'B', 'C', 'D']
        and bool_and(length(trim(coalesce(o ->> 'text', ''))) > 0)
      from jsonb_array_elements(p_options) o
    );
$$;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id),
  topic_id uuid references public.topics (id),
  body text not null check (length(trim(body)) > 0),
  -- Comprehension passages: the same stem can apply to different passages.
  passage text,
  options jsonb not null,
  correct_option text check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text,
  image_path text,
  year int check (year between 1978 and 2100),
  -- Original Exam Prep A1 id, kept so every import can be traced back and re-verified.
  source_ref text unique,
  content_hash text not null unique,
  status public.question_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Drafts may hold imperfect imports (older papers can have five options). Published rows may not.
  constraint published_questions_are_complete check (
    status <> 'published'
    or (public.is_valid_question_options(options) and correct_option is not null)
  )
);
create index questions_pick_idx on public.questions (subject_id, topic_id, status);

-- Accounts ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or length(trim(display_name)) between 2 and 30),
  role public.user_role not null default 'student',
  onboarded_at timestamptz,
  -- Captured now so ambassador attribution data exists before V2 is built.
  referral_code_used text,
  created_at timestamptz not null default now()
);

create table public.student_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  target_score int not null check (target_score between 0 and 400),
  updated_at timestamptz not null default now()
);

create table public.student_subjects (
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text not null references public.subjects (id),
  primary key (user_id, subject_id)
);

create table public.player_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_practice_day date,
  day_questions int not null default 0,
  sessions_completed int not null default 0,
  questions_answered int not null default 0,
  subjects jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Practice sessions ---------------------------------------------------------

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode public.practice_mode not null,
  config jsonb not null,
  feedback text not null check (feedback in ('instant', 'end')),
  status public.session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  question_count int not null,
  answered_count int,
  correct_count int,
  accuracy int,
  duration_sec int,
  utme_score int,
  per_subject jsonb,
  reward jsonb
);
create index practice_sessions_user_idx on public.practice_sessions (user_id, started_at desc);

-- Frozen at start, so bank edits never change a session in progress.
create table public.practice_session_questions (
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  position int not null,
  question_id uuid not null references public.questions (id),
  subject_id text not null references public.subjects (id),
  primary key (session_id, position),
  unique (session_id, question_id)
);

create table public.practice_answers (
  session_id uuid not null,
  question_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean,
  answered_at timestamptz not null default now(),
  primary key (session_id, question_id),
  foreign key (session_id, question_id)
    references public.practice_session_questions (session_id, question_id) on delete cascade
);
create index practice_answers_user_idx on public.practice_answers (user_id, answered_at desc);

-- Admin ---------------------------------------------------------------------

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (length(reason) between 1 and 60),
  note text check (note is null or length(note) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);
create index question_reports_open_idx on public.question_reports (status, created_at desc);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- Holding area for every bulk upload: the Exam Prep A1 migration and later admin imports.
create table public.question_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  file_name text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  summary jsonb
);

create table public.question_import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.question_import_batches (id) on delete cascade,
  source_ref text,
  raw jsonb not null,
  normalised jsonb,
  status public.import_row_status not null default 'pending',
  errors text[] not null default '{}',
  question_id uuid references public.questions (id) on delete set null
);
create index question_import_rows_batch_idx on public.question_import_rows (batch_id, status);

-- Triggers ------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger questions_touch before update on public.questions
  for each row execute function private.touch_updated_at();
create trigger student_goals_touch before update on public.student_goals
  for each row execute function private.touch_updated_at();
create trigger player_progress_touch before update on public.player_progress
  for each row execute function private.touch_updated_at();

create function private.normalise_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g'));
$$;

-- Same content in a different option order counts as a duplicate.
create function private.question_content_hash(
  p_subject text, p_body text, p_passage text, p_image text, p_options jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(concat_ws(
    '|',
    p_subject,
    private.normalise_text(p_body),
    private.normalise_text(p_passage),
    coalesce(p_image, ''),
    (
      select string_agg(private.normalise_text(o ->> 'text'), '|' order by private.normalise_text(o ->> 'text'))
      from jsonb_array_elements(p_options) o
    )
  ));
$$;

-- Definer: admins and the import job can't reach the private schema directly.
create function private.set_question_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content_hash := private.question_content_hash(
    new.subject_id, new.body, new.passage, new.image_path, new.options
  );
  return new;
end;
$$;

create trigger questions_set_hash before insert or update on public.questions
  for each row execute function private.set_question_hash();

-- Every account, including anonymous guests, gets a profile and progress row.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.player_progress (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
