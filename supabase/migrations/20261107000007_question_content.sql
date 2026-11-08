-- Rebuilds the question bank around structured content. The bank was empty when this was
-- applied, so nothing is migrated. Answers and solutions now live in their own table,
-- so a query for a question cannot carry its answer by accident.
-- The content format is defined in lib/content/types.ts.

drop table public.questions cascade;
drop function private.question_content_hash(text, text, text, text, jsonb);
drop function public.is_valid_question_options(jsonb);

create type public.context_kind as enum ('passage', 'poem', 'extract', 'dialogue', 'data', 'figure');
create type public.question_source as enum ('past_paper', 'practice');
create type public.syllabus_paper as enum ('use_of_english', 'literature');

-- Subjects now match the question bank. Geography stays hidden until it has questions.
insert into public.subjects (id, name, short_name, is_compulsory, sort_order) values
  ('accounting', 'Accounting', 'Accounting', false, 85),
  ('crk', 'Christian Religious Knowledge', 'CRK', false, 87);
update public.subjects set active = false where id = 'geography';

-- Content checks ------------------------------------------------------------

-- A non-empty list of blocks with something to show. Detailed rules run at import.
create function public.has_content(p_blocks jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_blocks) = 'array' then exists (
    select 1
    from jsonb_array_elements(p_blocks) b
    where b ->> 'type' in ('math', 'verse', 'dialogue', 'table', 'figure')
      or (
        b ->> 'type' = 'paragraph'
        and case when jsonb_typeof(b -> 'content') = 'array' then exists (
          select 1 from jsonb_array_elements(b -> 'content') i
          where length(trim(coalesce(i ->> 'text', i ->> 'math', ''))) > 0
        ) else false end
      )
  ) else false end;
$$;

create function public.is_valid_question_options(p_options jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_options) = 'array' and jsonb_array_length(p_options) = 4 then (
    select array_agg(o ->> 'key' order by o ->> 'key') = array['A', 'B', 'C', 'D']
      and bool_and(public.has_content(o -> 'blocks'))
    from jsonb_array_elements(p_options) o
  ) else false end;
$$;

-- Taxonomy and shared material -----------------------------------------------

create table public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id),
  slug text not null,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (topic_id, slug)
);

-- One passage, poem, table or diagram serving several questions.
create table public.shared_contexts (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id),
  kind public.context_kind not null,
  title text,
  blocks jsonb not null check (public.has_content(blocks)),
  credit text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A book exists apart from any year, so a new set book never rewrites old questions.
create table public.prescribed_works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  edition text,
  created_at timestamptz not null default now(),
  unique (title, author, edition)
);

-- to_year null means the assignment is still current.
create table public.work_assignments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.prescribed_works (id) on delete cascade,
  paper public.syllabus_paper not null,
  from_year int not null check (from_year between 1978 and 2100),
  to_year int check (to_year between 1978 and 2100),
  check (to_year is null or to_year >= from_year),
  unique (work_id, paper, from_year)
);

-- Question bank -------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id),
  topic_id uuid references public.topics (id),
  subtopic_id uuid references public.subtopics (id),
  context_id uuid references public.shared_contexts (id),
  work_id uuid references public.prescribed_works (id),
  -- The chapter or extract within the work.
  work_reference text,
  instruction jsonb,
  stem jsonb not null check (public.has_content(stem)),
  options jsonb not null,
  year int check (year between 1978 and 2100),
  source public.question_source not null default 'past_paper',
  -- Original Exam Prep A1 id, kept so every import can be traced back and re-verified.
  source_ref text unique,
  content_hash text not null unique,
  status public.question_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Drafts may hold imperfect imports. Published rows may not.
  constraint published_options_are_complete check (
    status <> 'published' or public.is_valid_question_options(options)
  )
);
create index questions_pick_idx on public.questions (subject_id, topic_id, status);
create index questions_subtopic_idx on public.questions (subtopic_id) where subtopic_id is not null;
create index questions_context_idx on public.questions (context_id) where context_id is not null;
create index questions_work_idx on public.questions (work_id) where work_id is not null;

create table public.question_solutions (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  -- Stored, not yet sent to students. A hint mode will release it separately.
  hint jsonb,
  solution jsonb,
  updated_at timestamptz not null default now()
);

-- A published question must always have an answer. Deferred, so a question and its
-- solution can be written in one transaction, in either order.
create function private.require_question_solution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if tg_table_name = 'questions' then
    v_id := new.id;
  else
    v_id := old.question_id;
  end if;

  if exists (select 1 from public.questions where id = v_id and status = 'published')
    and not exists (select 1 from public.question_solutions where question_id = v_id)
  then
    raise exception 'published_question_needs_answer' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger questions_need_solution after insert or update on public.questions
  deferrable initially deferred
  for each row execute function private.require_question_solution();
create constraint trigger solutions_stay_on_published after delete on public.question_solutions
  deferrable initially deferred
  for each row execute function private.require_question_solution();

create trigger questions_touch before update on public.questions
  for each row execute function private.touch_updated_at();
create trigger question_solutions_touch before update on public.question_solutions
  for each row execute function private.touch_updated_at();
create trigger shared_contexts_touch before update on public.shared_contexts
  for each row execute function private.touch_updated_at();

-- Same content in a different option order counts as a duplicate.
-- The same stem against a different passage does not.
create function private.question_content_hash(
  p_subject text, p_stem jsonb, p_context uuid, p_options jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(concat_ws(
    '|',
    p_subject,
    private.normalise_text(p_stem::text),
    coalesce(p_context::text, ''),
    (
      select string_agg(private.normalise_text((o -> 'blocks')::text), '|' order by private.normalise_text((o -> 'blocks')::text))
      from jsonb_array_elements(p_options) o
    )
  ));
$$;

create or replace function private.set_question_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content_hash := private.question_content_hash(new.subject_id, new.stem, new.context_id, new.options);
  return new;
end;
$$;

create trigger questions_set_hash before insert or update on public.questions
  for each row execute function private.set_question_hash();

-- Links dropped with the old table ------------------------------------------

alter table public.practice_session_questions
  add foreign key (question_id) references public.questions (id);
alter table public.question_reports
  add foreign key (question_id) references public.questions (id) on delete cascade;
alter table public.question_import_rows
  add foreign key (question_id) references public.questions (id) on delete set null;

-- Session payloads ----------------------------------------------------------

-- Everything needed to answer, and nothing that gives the answer away.
create function private.public_question(q public.questions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'subjectId', q.subject_id,
    'topicId', q.topic_id,
    'instruction', q.instruction,
    'context', (
      select jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'blocks', c.blocks, 'credit', c.credit)
      from public.shared_contexts c
      where c.id = q.context_id
    ),
    'work', (
      select jsonb_build_object('title', w.title, 'author', w.author, 'reference', q.work_reference)
      from public.prescribed_works w
      where w.id = q.work_id
    ),
    'stem', q.stem,
    'options', q.options
  );
$$;

create function private.reveal(q public.questions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('questionId', q.id, 'correctOption', s.correct_option, 'solution', s.solution)
  from public.question_solutions s
  where s.question_id = q.id;
$$;

create or replace function private.finalise_session(p_id uuid, p_status public.session_status)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s public.practice_sessions;
  p public.player_progress;
  r record;
  v_mock boolean;
  v_max int;
  v_total int;
  v_answered int;
  v_correct int;
  v_accuracy int;
  v_per jsonb;
  v_utme int;
  v_xp int;
  v_stars int;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_streak int;
  v_before int;
  v_after int;
  v_subjects jsonb;
  v_row jsonb;
begin
  select * into s from public.practice_sessions where id = p_id for update;
  if not found or s.status <> 'in_progress' then
    return;
  end if;

  update public.practice_answers a
  set is_correct = (a.selected_option = q.correct_option)
  from public.question_solutions q
  where a.session_id = p_id and q.question_id = a.question_id;

  select count(*), count(a.question_id), count(*) filter (where a.is_correct)
  into v_total, v_answered, v_correct
  from public.practice_session_questions sq
  left join public.practice_answers a
    on a.session_id = sq.session_id and a.question_id = sq.question_id
  where sq.session_id = p_id;

  v_accuracy := case when v_total = 0 then 0 else round(v_correct * 100.0 / v_total) end;
  v_mock := s.mode = 'mock';
  v_max := coalesce((s.config ->> 'maxPerSubject')::int, 100);

  select
    coalesce(jsonb_agg(
      jsonb_build_object('subjectId', x.subject_id, 'total', x.total, 'correct', x.correct, 'answered', x.answered)
      || case when v_mock then jsonb_build_object('scaledScore', x.scaled) else '{}'::jsonb end
      order by x.first_position
    ), '[]'::jsonb),
    case when v_mock then coalesce(sum(x.scaled), 0)::int end
  into v_per, v_utme
  from (
    select
      sq.subject_id,
      min(sq.position) as first_position,
      count(*)::int as total,
      count(a.question_id)::int as answered,
      (count(*) filter (where a.is_correct))::int as correct,
      round((count(*) filter (where a.is_correct)) * v_max::numeric / count(*))::int as scaled
    from public.practice_session_questions sq
    left join public.practice_answers a
      on a.session_id = sq.session_id and a.question_id = sq.question_id
    where sq.session_id = p_id
    group by sq.subject_id
  ) x;

  v_stars := case
    when v_accuracy >= 90 then 3
    when v_accuracy >= 70 then 2
    when v_accuracy >= 40 then 1
    else 0
  end;

  v_xp := case when v_answered = 0 then 0
    else v_correct * 2 + 2 + case when v_stars = 3 then 2 else 0 end
  end;

  insert into public.player_progress (user_id) values (s.user_id) on conflict do nothing;
  select * into p from public.player_progress where user_id = s.user_id for update;

  v_streak := case
    when p.last_practice_day is not null and v_today - p.last_practice_day <= 1 then p.current_streak
    else 0
  end;
  if v_answered > 0 and p.last_practice_day is distinct from v_today then
    v_streak := v_streak + 1;
  end if;

  v_subjects := p.subjects;
  for r in select value from jsonb_array_elements(v_per) loop
    v_row := v_subjects -> (r.value ->> 'subjectId');
    v_subjects := v_subjects || jsonb_build_object(
      r.value ->> 'subjectId',
      jsonb_build_object(
        'answered', coalesce((v_row ->> 'answered')::int, 0) + (r.value ->> 'answered')::int,
        'correct', coalesce((v_row ->> 'correct')::int, 0) + (r.value ->> 'correct')::int
      )
    );
  end loop;

  v_before := private.level_for(p.xp);
  v_after := private.level_for(p.xp + v_xp);

  update public.player_progress
  set xp = p.xp + v_xp,
      current_streak = v_streak,
      best_streak = greatest(p.best_streak, v_streak),
      last_practice_day = case when v_answered > 0 then v_today else p.last_practice_day end,
      day_questions = case
        when v_answered = 0 then p.day_questions
        when p.last_practice_day = v_today then p.day_questions + v_answered
        else v_answered
      end,
      sessions_completed = p.sessions_completed + 1,
      questions_answered = p.questions_answered + v_answered,
      subjects = v_subjects
  where user_id = s.user_id;

  update public.practice_sessions
  set status = p_status,
      submitted_at = now(),
      answered_count = v_answered,
      correct_count = v_correct,
      accuracy = v_accuracy,
      duration_sec = greatest(0, round(extract(epoch from least(now(), s.deadline_at) - s.started_at)))::int,
      utme_score = v_utme,
      per_subject = v_per,
      reward = jsonb_build_object(
        'sessionId', s.id,
        'xpGained', v_xp,
        'stars', v_stars,
        'levelBefore', v_before,
        'levelAfter', v_after,
        'streak', v_streak
      )
  where id = p_id;
end;
$$;

-- Media ---------------------------------------------------------------------

-- Public read: source figures must load fast on any device. Solution figures use unguessable
-- paths and are only named in payloads once revealed. Files are written by the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-media', 'question-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

-- Security ------------------------------------------------------------------

alter table public.subtopics enable row level security;
alter table public.shared_contexts enable row level security;
alter table public.prescribed_works enable row level security;
alter table public.work_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.question_solutions enable row level security;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on public.subtopics, public.shared_contexts, public.prescribed_works, public.work_assignments,
  public.questions, public.question_solutions from anon, authenticated;
revoke all on function public.has_content(jsonb), public.is_valid_question_options(jsonb) from public, anon, authenticated;
grant execute on function public.has_content(jsonb), public.is_valid_question_options(jsonb) to anon, authenticated;

grant select on public.subtopics, public.prescribed_works, public.work_assignments to anon, authenticated;
grant insert, update, delete on public.subtopics, public.prescribed_works, public.work_assignments to authenticated;
grant select, insert, update, delete on public.questions, public.question_solutions, public.shared_contexts to authenticated;

create policy subtopics_read on public.subtopics for select to anon, authenticated using (true);
create policy subtopics_admin_insert on public.subtopics for insert to authenticated with check (public.is_admin());
create policy subtopics_admin_update on public.subtopics for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subtopics_admin_delete on public.subtopics for delete to authenticated using (public.is_admin());

create policy prescribed_works_read on public.prescribed_works for select to anon, authenticated using (true);
create policy prescribed_works_admin_insert on public.prescribed_works for insert to authenticated with check (public.is_admin());
create policy prescribed_works_admin_update on public.prescribed_works for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy prescribed_works_admin_delete on public.prescribed_works for delete to authenticated using (public.is_admin());

create policy work_assignments_read on public.work_assignments for select to anon, authenticated using (true);
create policy work_assignments_admin_insert on public.work_assignments for insert to authenticated with check (public.is_admin());
create policy work_assignments_admin_update on public.work_assignments for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy work_assignments_admin_delete on public.work_assignments for delete to authenticated using (public.is_admin());

-- Admins only. Students receive all of this solely through the session functions.
create policy questions_admin on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy question_solutions_admin on public.question_solutions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy shared_contexts_admin on public.shared_contexts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
