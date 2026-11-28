-- The path: a trail of topic groups ("units") per subject, with up to three stars per unit.
--
-- Design: docs/path-build-plan.md. Question supply: docs/path-question-audit.md.
--   * A unit is a named group of one or more topics, held in data so a row edit changes the path.
--   * Stars come from the answers a student already gives, in any practice mode, and are kept once earned.
--       1 star : a round on the unit at 6 of 10 or better
--       2 stars: on a later day, 10 or more recent answers on the unit at 70% or better
--       3 stars: 7 or more days after star 2, 10 or more recent answers at 80% or better
--     "Revisit" is a live flag on top: a started unit with 8 or more answers in 14 days under 60%.
--   * Unit rounds are ordinary "subject" sessions whose config carries unitIds, so the round screen,
--     rewards and results work unchanged.

-- Tables --------------------------------------------------------------------

create table public.path_units (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id),
  slug text not null,
  name text not null,
  -- Syllabus order. "Most asked first" is worked out from question counts.
  sort_order int not null,
  active boolean not null default true,
  unique (subject_id, slug)
);

create table public.path_unit_topics (
  unit_id uuid not null references public.path_units (id) on delete cascade,
  -- A topic belongs to at most one unit, so one answer never counts toward two units.
  topic_id uuid not null unique references public.topics (id),
  primary key (unit_id, topic_id)
);

create table public.path_stars (
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id uuid not null references public.path_units (id) on delete cascade,
  stars int not null default 0 check (stars between 0 and 3),
  star1_at timestamptz,
  star2_at timestamptz,
  star3_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);

create table public.path_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the student has been asked. 'path' follows the trail, 'practice' just practises.
  mode text check (mode in ('path', 'practice')),
  order_by text not null default 'asked' check (order_by in ('asked', 'syllabus')),
  updated_at timestamptz not null default now()
);

alter table public.path_units enable row level security;
alter table public.path_unit_topics enable row level security;
alter table public.path_stars enable row level security;
alter table public.path_prefs enable row level security;

grant select on public.path_units, public.path_unit_topics to anon, authenticated;
grant select on public.path_stars, public.path_prefs to authenticated;

create policy path_units_read on public.path_units for select to anon, authenticated using (true);
create policy path_unit_topics_read on public.path_unit_topics for select to anon, authenticated using (true);
-- Stars are written only by the server, never by the browser.
create policy path_stars_own on public.path_stars for select to authenticated using (user_id = auth.uid());
create policy path_prefs_own on public.path_prefs for select to authenticated using (user_id = auth.uid());

-- Maths units ---------------------------------------------------------------
-- 23 topics in 13 units, so every unit holds enough questions for a round on two different days.

with u(slug, name, sort_order) as (values
  ('bases-sets-operations-matrices', 'Bases, sets, operations and matrices', 10),
  ('fractions-decimals-percentages', 'Fractions, decimals and percentages', 20),
  ('indices-logarithms-surds', 'Indices, logarithms and surds', 30),
  ('polynomials-equations', 'Polynomials and equations', 40),
  ('variation-inequalities', 'Variation and inequalities', 50),
  ('progression', 'Progression', 60),
  ('euclidean-geometry', 'Euclidean geometry', 70),
  ('mensuration', 'Mensuration', 80),
  ('calculus-loci-counting', 'Calculus, loci and counting', 90),
  ('coordinate-geometry', 'Coordinate geometry', 100),
  ('trigonometry', 'Trigonometry', 110),
  ('statistics', 'Statistics', 120),
  ('probability', 'Probability', 130)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'mathematics', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('bases-sets-operations-matrices', 'number-bases-and-modular-arithmetic'),
  ('bases-sets-operations-matrices', 'sets'),
  ('bases-sets-operations-matrices', 'binary-operations'),
  ('bases-sets-operations-matrices', 'matrices-and-determinants'),
  ('fractions-decimals-percentages', 'fractions-decimals-approximations-and-percentages'),
  ('indices-logarithms-surds', 'indices-logarithms-and-surds'),
  ('polynomials-equations', 'polynomials-and-equations'),
  ('variation-inequalities', 'variation'),
  ('variation-inequalities', 'inequalities'),
  ('progression', 'progression'),
  ('euclidean-geometry', 'euclidean-geometry'),
  ('mensuration', 'mensuration'),
  ('calculus-loci-counting', 'differentiation'),
  ('calculus-loci-counting', 'application-of-differentiation'),
  ('calculus-loci-counting', 'integration'),
  ('calculus-loci-counting', 'loci'),
  ('calculus-loci-counting', 'permutation-and-combination'),
  ('coordinate-geometry', 'coordinate-geometry'),
  ('trigonometry', 'trigonometry'),
  ('statistics', 'representation-of-data'),
  ('statistics', 'measures-of-location'),
  ('statistics', 'measures-of-dispersion'),
  ('probability', 'probability')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'mathematics' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'mathematics' and t.slug = m.topic_slug;

do $$
begin
  if (select count(*) from public.path_unit_topics) <> 23 then
    raise exception 'Maths units must cover all 23 topics, found %', (select count(*) from public.path_unit_topics);
  end if;
end;
$$;

-- Picking -------------------------------------------------------------------
-- Questions the student has never answered come first, then the ones answered longest ago. One copy
-- of each question (the bank keeps a row per exam year), and answering any copy counts as seeing it.

create function private.pick_unit_questions(p_user uuid, p_topics uuid[], p_count int)
returns setof uuid
language sql
volatile
set search_path = ''
as $$
  select d.id
  from (
    select distinct on (q.content_hash)
      q.id,
      q.content_hash,
      (
        select max(a.answered_at)
        from public.practice_answers a
        join public.questions q2 on q2.id = a.question_id
        where a.user_id = p_user and q2.content_hash = q.content_hash
      ) as last_seen
    from public.questions q
    where q.status = 'published'
      and q.topic_id = any (p_topics)
    order by q.content_hash, random()
  ) d
  order by d.last_seen asc nulls first, random()
  limit p_count;
$$;

-- Starting a round ----------------------------------------------------------
-- Same function as before, plus: a "subject" round may carry unitId (one unit) or unitIds with
-- checkpoint = true (a mixed check across the units of a section).

create or replace function public.start_session(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_mode_text text := p_config ->> 'mode';
  v_mode public.practice_mode;
  v_subjects text[];
  v_topic uuid;
  v_topics uuid[];
  v_unit_ids uuid[];
  v_checkpoint boolean := false;
  v_count int;
  v_duration int;
  v_feedback text;
  v_format public.exam_formats;
  v_session uuid := gen_random_uuid();
  v_config jsonb;
  v_subject text;
  v_want int;
  v_got int;
  v_position int := 0;
begin
  if (
    select count(*) from public.practice_sessions
    where user_id = v_user and started_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if v_mode_text is null or v_mode_text not in ('quick_five', 'subject', 'timed', 'mock') then
    raise exception 'invalid_mode' using errcode = 'P0001';
  end if;
  v_mode := v_mode_text::public.practice_mode;

  -- Set here, not read from the client, so a timed session can't request instant answers.
  v_feedback := case when v_mode in ('quick_five', 'subject') then 'instant' else 'end' end;

  if v_mode = 'mock' then
    if private.is_guest() then
      raise exception 'account_required' using errcode = 'P0001';
    end if;

    select * into v_format from public.exam_formats where active;
    if not found then
      raise exception 'no_exam_format' using errcode = 'P0001';
    end if;

    select array_agg(ss.subject_id order by sub.is_compulsory desc, sub.sort_order)
    into v_subjects
    from public.student_subjects ss
    join public.subjects sub on sub.id = ss.subject_id
    where ss.user_id = v_user;

    if coalesce(cardinality(v_subjects), 0) <> (v_format.rules ->> 'subject_count')::int then
      raise exception 'onboarding_required' using errcode = 'P0001';
    end if;

    v_duration := v_format.total_duration_sec;
  else
    v_subjects := array[p_config -> 'subjectIds' ->> 0];
    if not exists (select 1 from public.subjects where id = v_subjects[1] and active) then
      raise exception 'invalid_subject' using errcode = 'P0001';
    end if;

    v_topic := nullif(p_config ->> 'topicId', '')::uuid;
    if v_topic is not null and not exists (
      select 1 from public.topics where id = v_topic and subject_id = v_subjects[1]
    ) then
      raise exception 'invalid_topic' using errcode = 'P0001';
    end if;

    -- Path rounds: only a "subject" round can target units.
    if p_config ? 'unitIds' or nullif(p_config ->> 'unitId', '') is not null then
      if v_mode <> 'subject' then
        raise exception 'invalid_unit' using errcode = 'P0001';
      end if;
      v_unit_ids := case
        when p_config ? 'unitIds' then array(select jsonb_array_elements_text(p_config -> 'unitIds')::uuid)
        else array[(p_config ->> 'unitId')::uuid]
      end;
      v_checkpoint := coalesce((p_config ->> 'checkpoint')::boolean, false);
      if cardinality(v_unit_ids) not between 1 and 10 or (cardinality(v_unit_ids) > 1 and not v_checkpoint) then
        raise exception 'invalid_unit' using errcode = 'P0001';
      end if;
      if (
        select count(*) from public.path_units
        where id = any (v_unit_ids) and subject_id = v_subjects[1] and active
      ) <> cardinality(v_unit_ids) then
        raise exception 'invalid_unit' using errcode = 'P0001';
      end if;
      select array_agg(put.topic_id) into v_topics
      from public.path_unit_topics put
      where put.unit_id = any (v_unit_ids);
      v_topic := null;
    end if;

    if v_mode = 'quick_five' then
      v_count := 5;
      v_topic := null;
    else
      v_count := (p_config ->> 'count')::int;
      if v_count is null or v_count not between 1 and 100 then
        raise exception 'invalid_count' using errcode = 'P0001';
      end if;
    end if;

    if v_mode = 'timed' then
      v_duration := (p_config ->> 'durationSec')::int;
      if v_duration is null or v_duration not between 60 and 10800 then
        raise exception 'invalid_duration' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into public.practice_sessions (id, user_id, mode, config, feedback, deadline_at, question_count)
  values (
    v_session, v_user, v_mode, '{}'::jsonb, v_feedback,
    case when v_duration is not null then now() + make_interval(secs => v_duration) end,
    0
  );

  foreach v_subject in array v_subjects loop
    v_want := case
      when v_mode <> 'mock' then v_count
      when v_subject = v_format.compulsory_subject_id then (v_format.rules ->> 'compulsory_question_count')::int
      else (v_format.rules ->> 'other_question_count')::int
    end;

    if v_topics is not null then
      insert into public.practice_session_questions (session_id, position, question_id, subject_id)
      select v_session, v_position + row_number() over (), id, v_subject
      from private.pick_unit_questions(v_user, v_topics, v_want) as id;
    else
      insert into public.practice_session_questions (session_id, position, question_id, subject_id)
      select v_session, v_position + row_number() over (), id, v_subject
      from private.pick_questions(v_user, v_subject, v_topic, v_want) as id;
    end if;

    get diagnostics v_got = row_count;
    if v_got = 0 then
      raise exception 'no_questions' using errcode = 'P0001';
    end if;
    if v_mode = 'mock' and v_got < v_want then
      raise exception 'insufficient_questions' using errcode = 'P0001';
    end if;
    v_position := v_position + v_got;
  end loop;

  v_config := jsonb_build_object(
    'mode', v_mode,
    'subjectIds', to_jsonb(v_subjects),
    'topicId', v_topic,
    'count', v_position,
    'durationSec', v_duration,
    'feedback', v_feedback
  );
  if v_mode = 'mock' then
    v_config := v_config || jsonb_build_object('maxPerSubject', (v_format.rules ->> 'max_per_subject')::int);
  end if;
  if v_unit_ids is not null then
    v_config := v_config || jsonb_build_object('unitIds', to_jsonb(v_unit_ids), 'checkpoint', v_checkpoint);
  end if;

  update public.practice_sessions
  set config = v_config, question_count = v_position
  where id = v_session;

  return private.session_payload(v_session);
end;
$$;

-- Awarding stars ------------------------------------------------------------
-- Runs as a session is finished, from a trigger, so it covers every mode and every way a session can
-- end, and the engine's own finishing function stays untouched. It sees the session's new values.
-- Days are Lagos days, like streaks.

create function private.update_path_stars(s public.practice_sessions)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_row public.path_stars;
  v_before int;
  v_n int;
  v_c int;
  v_checkpoint boolean := coalesce((s.config ->> 'checkpoint')::boolean, false);
  v_unit_round boolean := (s.config ? 'unitIds') and not coalesce((s.config ->> 'checkpoint')::boolean, false);
  v_units jsonb := '[]'::jsonb;
  v_single uuid;
  v_single_before int;
  v_single_after int;
begin
  for r in
    select distinct put.unit_id
    from public.practice_session_questions sq
    join public.questions q on q.id = sq.question_id
    join public.path_unit_topics put on put.topic_id = q.topic_id
    where sq.session_id = s.id
  loop
    insert into public.path_stars (user_id, unit_id) values (s.user_id, r.unit_id) on conflict do nothing;
    select * into v_row from public.path_stars where user_id = s.user_id and unit_id = r.unit_id for update;
    v_before := v_row.stars;

    -- Star 1: a round on this unit alone at 6 of 10 or better.
    if v_row.stars = 0
       and v_unit_round
       and s.config -> 'unitIds' = jsonb_build_array(r.unit_id::text)
       and s.question_count >= 5
       and coalesce(s.correct_count, 0) * 10 >= s.question_count * 6 then
      v_row.stars := 1;
      v_row.star1_at := now();
    end if;

    -- Star 2: on a later day, the last 20 answers (at least 10) at 70% or better.
    if v_row.stars = 1 then
      select count(*), count(*) filter (where w.is_correct) into v_n, v_c
      from (
        select a.is_correct
        from public.practice_answers a
        join public.questions q on q.id = a.question_id
        join public.path_unit_topics put on put.topic_id = q.topic_id and put.unit_id = r.unit_id
        where a.user_id = s.user_id
          and a.is_correct is not null
          and (a.answered_at at time zone 'Africa/Lagos')::date > (v_row.star1_at at time zone 'Africa/Lagos')::date
        order by a.answered_at desc
        limit 20
      ) w;
      if v_n >= 10 and v_c * 10 >= v_n * 7 then
        v_row.stars := 2;
        v_row.star2_at := now();
      end if;
    end if;

    -- Star 3: a week after star 2, the last 20 answers (at least 10) at 80% or better.
    if v_row.stars = 2 then
      select count(*), count(*) filter (where w.is_correct) into v_n, v_c
      from (
        select a.is_correct
        from public.practice_answers a
        join public.questions q on q.id = a.question_id
        join public.path_unit_topics put on put.topic_id = q.topic_id and put.unit_id = r.unit_id
        where a.user_id = s.user_id
          and a.is_correct is not null
          and (a.answered_at at time zone 'Africa/Lagos')::date >= (v_row.star2_at at time zone 'Africa/Lagos')::date + 7
        order by a.answered_at desc
        limit 20
      ) w;
      if v_n >= 10 and v_c * 10 >= v_n * 8 then
        v_row.stars := 3;
        v_row.star3_at := now();
      end if;
    end if;

    if v_row.stars <> v_before then
      update public.path_stars
      set stars = v_row.stars, star1_at = v_row.star1_at, star2_at = v_row.star2_at,
          star3_at = v_row.star3_at, updated_at = now()
      where user_id = s.user_id and unit_id = r.unit_id;
    end if;

    v_units := v_units || jsonb_build_object('unitId', r.unit_id, 'starsBefore', v_before, 'starsAfter', v_row.stars);
    if v_unit_round and s.config -> 'unitIds' = jsonb_build_array(r.unit_id::text) then
      v_single := r.unit_id;
      v_single_before := v_before;
      v_single_after := v_row.stars;
    end if;
  end loop;

  if jsonb_array_length(v_units) = 0 then
    return null;
  end if;

  return jsonb_build_object(
    'unitId', v_single,
    'starsBefore', v_single_before,
    'starsAfter', v_single_after,
    'checkpoint', v_checkpoint,
    'units', v_units
  );
end;
$$;

-- A failure in star logic must never stop a student finishing their round, so errors are logged and skipped.
create function private.path_on_session_done()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_path jsonb;
begin
  begin
    v_path := private.update_path_stars(new);
  exception when others then
    raise warning 'path stars skipped: %', sqlerrm;
    v_path := null;
  end;
  if v_path is not null then
    new.reward := coalesce(new.reward, '{}'::jsonb) || jsonb_build_object('path', v_path);
  end if;
  return new;
end;
$$;

create trigger practice_sessions_path_stars
  before update of status on public.practice_sessions
  for each row
  when (old.status = 'in_progress' and new.status in ('submitted', 'expired'))
  execute function private.path_on_session_done();

-- Reading the path ----------------------------------------------------------

-- One subject's units for one student, in "most asked first" order. Both orders are returned as ranks,
-- so the screen can switch without another call.
create function private.path_subject(p_user uuid, p_subject text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with units as (
    select
      pu.id, pu.slug, pu.name, pu.sort_order,
      (
        select count(distinct q.content_hash)
        from public.path_unit_topics put
        join public.questions q on q.topic_id = put.topic_id and q.status = 'published'
        where put.unit_id = pu.id
      )::int as question_count
    from public.path_units pu
    where pu.subject_id = p_subject and pu.active
  ),
  ranked as (
    select
      u.*,
      row_number() over (order by u.question_count desc, u.sort_order) as asked_rank,
      row_number() over (order by u.sort_order) as syllabus_rank
    from units u
  ),
  ev as (
    select
      r.id as unit_id,
      count(a.question_id)::int as answers,
      count(distinct (a.answered_at at time zone 'Africa/Lagos')::date)::int as days,
      (count(*) filter (where a.answered_at > now() - interval '14 days'))::int as n14,
      (count(*) filter (where a.answered_at > now() - interval '14 days' and a.is_correct))::int as c14
    from ranked r
    left join public.path_unit_topics put on put.unit_id = r.id
    left join public.questions q on q.topic_id = put.topic_id
    left join public.practice_answers a on a.question_id = q.id and a.user_id = p_user and a.is_correct is not null
    group by r.id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'slug', r.slug,
      'name', r.name,
      'questionCount', r.question_count,
      'askedRank', r.asked_rank,
      'syllabusRank', r.syllabus_rank,
      'stars', coalesce(ps.stars, 0),
      'answers', ev.answers,
      'days', ev.days,
      'revisit', coalesce(ps.stars, 0) >= 1 and ev.n14 >= 8 and ev.c14 * 10 < ev.n14 * 6
    )
    order by r.asked_rank
  ), '[]'::jsonb)
  from ranked r
  join ev on ev.unit_id = r.id
  left join public.path_stars ps on ps.unit_id = r.id and ps.user_id = p_user;
$$;

create function public.get_path(p_subject text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  return jsonb_build_object(
    'subjectId', p_subject,
    'units', private.path_subject(v_user, p_subject),
    -- Mixed checks already taken, so the screen can mark a section's check as done.
    'checkpoints', coalesce((
      select jsonb_agg(
        jsonb_build_object('unitIds', s.config -> 'unitIds', 'accuracy', s.accuracy, 'at', s.submitted_at)
        order by s.submitted_at desc
      )
      from public.practice_sessions s
      where s.user_id = v_user
        and s.status = 'submitted'
        and s.config ->> 'checkpoint' = 'true'
        and s.config -> 'subjectIds' ->> 0 = p_subject
    ), '[]'::jsonb),
    'prefs', (
      select jsonb_build_object('mode', pp.mode, 'order', pp.order_by)
      from (select 1) one
      left join public.path_prefs pp on pp.user_id = v_user
    )
  );
end;
$$;

-- For Home: one line per subject that has a path, with the next unit to do.
create function public.get_path_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
  v_mode text;
  v_order text := 'asked';
  v_out jsonb := '[]'::jsonb;
  v_units jsonb;
  r record;
begin
  select pp.mode, pp.order_by into v_mode, v_order from public.path_prefs pp where pp.user_id = v_user;
  v_order := coalesce(v_order, 'asked');

  for r in select distinct pu.subject_id from public.path_units pu where pu.active order by 1 loop
    v_units := private.path_subject(v_user, r.subject_id);
    v_out := v_out || (
      select jsonb_build_object(
        'subjectId', r.subject_id,
        'unitCount', count(*),
        'started', count(*) filter (where (e ->> 'answers')::int > 0),
        'stars', coalesce(sum((e ->> 'stars')::int), 0),
        'maxStars', count(*) * 3,
        'next', (
          select jsonb_build_object('id', x ->> 'id', 'name', x ->> 'name',
            'index', case when v_order = 'syllabus' then (x ->> 'syllabusRank')::int else (x ->> 'askedRank')::int end)
          from jsonb_array_elements(v_units) x
          where (x ->> 'stars')::int < 3
          order by case when (x ->> 'stars')::int = 0 then 0 else 1 end,
                   case when v_order = 'syllabus' then (x ->> 'syllabusRank')::int else (x ->> 'askedRank')::int end
          limit 1
        )
      )
      from jsonb_array_elements(v_units) e
    );
  end loop;

  return jsonb_build_object('mode', v_mode, 'order', v_order, 'subjects', v_out);
end;
$$;

create function public.set_path_prefs(p_mode text, p_order text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.require_user();
begin
  if p_mode is not null and p_mode not in ('path', 'practice') then
    raise exception 'invalid_mode' using errcode = 'P0001';
  end if;
  if p_order is not null and p_order not in ('asked', 'syllabus') then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;

  insert into public.path_prefs (user_id, mode, order_by)
  values (v_user, p_mode, coalesce(p_order, 'asked'))
  on conflict (user_id) do update
  set mode = coalesce(p_mode, public.path_prefs.mode),
      order_by = coalesce(p_order, public.path_prefs.order_by),
      updated_at = now();
end;
$$;

grant execute on function public.get_path(text), public.get_path_overview(), public.set_path_prefs(text, text) to authenticated;

-- Events ---------------------------------------------------------------------
-- The whitelist is the full list, as in the previous migration.

create or replace function public.track_event(p_visitor text, p_name text, p_props jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name not in (
    'landing_view', 'start_click', 'round_started', 'round_completed', 'free_limit_reached',
    'register_view', 'register_submitted', 'onboarding_done',
    'game_started', 'game_completed', 'install_accepted', 'reminders_enabled',
    'leaderboard_view', 'landing_card_click', 'landing_start_click',
    'needs_work_shown', 'needs_work_tapped',
    'partner_invite_shared', 'partner_request_sent', 'partner_accepted', 'partner_nudge_sent', 'partner_commitment_set',
    'path_view', 'path_unit_open', 'path_choice', 'path_star_earned', 'path_check_started'
  ) then
    return;
  end if;
  if length(coalesce(p_visitor, '')) not between 8 and 64 then
    return;
  end if;
  insert into public.events (visitor_id, user_id, name, props)
  values (
    p_visitor,
    auth.uid(),
    p_name,
    case when p_props is not null and jsonb_typeof(p_props) = 'object' and length(p_props::text) <= 500 then p_props else '{}'::jsonb end
  );
end;
$$;

-- Housekeeping ---------------------------------------------------------------

revoke all on function
  private.pick_unit_questions(uuid, uuid[], int),
  private.update_path_stars(public.practice_sessions),
  private.path_on_session_done(),
  private.path_subject(uuid, text)
from public, anon, authenticated;
